#!/usr/bin/env node
/**
 * Writes docs/DATABASE.md: an entity-relationship diagram (Mermaid) generated
 * from the live database that DATABASE_URL points to, so it cannot drift from
 * the real schema. GitHub and VS Code render the diagrams.
 *
 *   npm run db:er
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, closePool } from '../src/db/pool.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.join(here, '..', '..', 'docs', 'DATABASE.md');

/** How the tables are grouped in the document. Anything unlisted lands in "Other". */
const GROUPS = [
  {
    title: 'Catalogue and inventory',
    note: 'Products belong to one brand and one category (categories nest). Stock is kept per store and product; every change is appended to `inventory_movements`.',
    tables: ['brands', 'categories', 'products', 'stores', 'inventory', 'inventory_movements'],
  },
  {
    title: 'Users, cart and orders',
    note: 'One cart per user. Checkout turns cart lines into an order with its own lines and takes stock from one store.',
    tables: ['users', 'refresh_tokens', 'carts', 'cart_items', 'orders', 'order_items'],
  },
  {
    title: 'Support',
    note: 'Tables only - there is no support API yet.',
    tables: ['support_tickets', 'ticket_messages'],
  },
  {
    title: 'Knowledge base and agent audit',
    note: '`kb_documents` / `kb_chunks` were created by the backend and are unused. `documents` / `document_chunks` are owned and filled by `ai-service` (the RAG pipeline). `agent_actions` is the audit log for agent decisions.',
    tables: ['kb_documents', 'kb_chunks', 'documents', 'document_chunks', 'agent_actions'],
  },
];
const HIDDEN = new Set(['schema_migrations', 'ai_schema_migrations']);

const TYPE_NAMES = {
  'timestamp with time zone': 'timestamptz',
  'time without time zone': 'time',
  'character varying': 'varchar',
  character: 'char',
  integer: 'int',
  boolean: 'bool',
  'double precision': 'float8',
};

async function introspect() {
  const { rows: columns } = await pool.query(`
    SELECT c.table_name, c.column_name, c.data_type, c.udt_name, c.is_nullable = 'YES' AS nullable,
           c.ordinal_position
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
     WHERE c.table_schema = 'public'
     ORDER BY c.table_name, c.ordinal_position`);

  // p = primary key, u = unique, f = foreign key; only public-schema targets.
  const { rows: constraints } = await pool.query(`
    SELECT con.contype, cl.relname AS table_name, ref.relname AS ref_table,
           (SELECT array_agg(a.attname::text ORDER BY k.ord)
              FROM unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord)
              JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.attnum) AS cols
      FROM pg_constraint con
      JOIN pg_class cl ON cl.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = cl.relnamespace
      LEFT JOIN pg_class ref ON ref.oid = con.confrelid
     WHERE ns.nspname = 'public' AND con.contype IN ('p', 'u', 'f')`);

  const { rows: views } = await pool.query(`
    SELECT table_name FROM information_schema.views WHERE table_schema = 'public' ORDER BY 1`);

  const { rows: counts } = await pool.query(`
    SELECT c.relname AS table_name,
           (xpath('/row/n/text()', query_to_xml('SELECT count(*) AS n FROM public.' || quote_ident(c.relname), false, true, '')))[1]::text::int AS n
      FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
     WHERE ns.nspname = 'public' AND c.relkind = 'r'`);

  const tables = new Map();
  for (const col of columns) {
    if (!tables.has(col.table_name)) tables.set(col.table_name, { columns: [], pk: [], unique: [], fks: [] });
    tables.get(col.table_name).columns.push(col);
  }
  for (const con of constraints) {
    const table = tables.get(con.table_name);
    if (!table) continue;
    if (con.contype === 'p') table.pk = con.cols;
    if (con.contype === 'u') table.unique.push(con.cols);
    if (con.contype === 'f') table.fks.push({ cols: con.cols, ref: con.ref_table });
  }
  return {
    tables,
    views: views.map((v) => v.table_name),
    counts: new Map(counts.map((c) => [c.table_name, c.n])),
  };
}

function typeOf(col) {
  if (col.data_type === 'USER-DEFINED') return col.udt_name; // enum or vector
  if (col.data_type === 'ARRAY') return `${col.udt_name.replace(/^_/, '')}_array`;
  return TYPE_NAMES[col.data_type] ?? col.data_type.replaceAll(' ', '_');
}

function entity(name, table) {
  const lines = table.columns.map((col) => {
    const keys = [];
    if (table.pk.includes(col.column_name)) keys.push('PK');
    if (table.fks.some((fk) => fk.cols.includes(col.column_name))) keys.push('FK');
    if (table.unique.some((u) => u.length === 1 && u[0] === col.column_name)) keys.push('UK');
    const optional = col.nullable ? ' "nullable"' : '';
    return `    ${typeOf(col)} ${col.column_name}${keys.length ? ` ${keys.join(',')}` : ''}${optional}`;
  });
  return `  ${name} {\n${lines.join('\n')}\n  }`;
}

/** parent ||--o{ child, with the child side narrowed to one when the FK is unique. */
function relation(child, table, fk) {
  const column = table.columns.find((c) => c.column_name === fk.cols[0]);
  const single =
    fk.cols.length === 1 &&
    (table.unique.some((u) => u.length === 1 && u[0] === fk.cols[0]) ||
      (table.pk.length === 1 && table.pk[0] === fk.cols[0]));
  const parentSide = column?.nullable ? '|o' : '||';
  const childSide = single ? 'o|' : 'o{';
  return `  ${fk.ref} ${parentSide}--${childSide} ${child} : "${fk.cols.join(', ')}"`;
}

function diagram(names, tables, { withColumns }) {
  const inScope = new Set(names);
  const out = ['```mermaid', 'erDiagram'];
  for (const name of names) {
    const table = tables.get(name);
    if (!table) continue;
    if (withColumns) out.push(entity(name, table));
    for (const fk of table.fks) {
      // Detailed diagrams only draw links inside the group, to stay readable.
      if (!withColumns || inScope.has(fk.ref)) out.push(relation(name, table, fk));
    }
  }
  out.push('```');
  return out.join('\n');
}

async function main() {
  const { tables, views, counts } = await introspect();
  const host = new URL((await import('../src/config/env.js')).default.databaseUrl).hostname;
  const all = [...tables.keys()].filter((t) => !HIDDEN.has(t));
  const grouped = new Set(GROUPS.flatMap((g) => g.tables));
  const groups = [...GROUPS];
  const other = all.filter((t) => !grouped.has(t));
  if (other.length) groups.push({ title: 'Other', note: '', tables: other });

  const fkCount = [...tables.values()].reduce((n, t) => n + t.fks.length, 0);
  const doc = [
    '# Database: entity-relationship diagram',
    '',
    `Generated by \`npm run db:er\` (in \`backend/\`) from the live schema at \`${host}\`. Do not edit by hand - re-run the script after a migration.`,
    '',
    `${all.length} tables, ${fkCount} foreign keys, ${views.length} views. The migrations in \`backend/db/migrations/\` are the source of truth.`,
    '',
    'Pre-rendered images of each diagram are in [`docs/er/`](er/), for viewers that do not draw Mermaid.',
    '',
    'Reading the lines: `||--o{` is one-to-many, `||--o|` is one-to-at-most-one, and a `|o` end means the link is optional (the foreign key may be null). The label is the foreign-key column.',
    '',
    '## Overview: every table and relationship',
    '',
    diagram(all, tables, { withColumns: false }),
    '',
  ];

  for (const group of groups) {
    const present = group.tables.filter((t) => tables.has(t));
    if (present.length === 0) continue;
    doc.push(`## ${group.title}`, '');
    if (group.note) doc.push(group.note, '');
    doc.push(diagram(present, tables, { withColumns: true }), '');
    const outside = present.flatMap((name) =>
      tables
        .get(name)
        .fks.filter((fk) => !present.includes(fk.ref))
        .map((fk) => `\`${name}.${fk.cols.join(', ')}\` → \`${fk.ref}\``)
    );
    if (outside.length) doc.push(`Links to other groups: ${outside.join(', ')}.`, '');
  }

  doc.push(
    '## Tables at a glance',
    '',
    '| Table | Rows | Primary key | References |',
    '|---|---:|---|---|',
    ...all.map((name) => {
      const t = tables.get(name);
      const refs = [...new Set(t.fks.map((fk) => fk.ref))].join(', ') || '—';
      return `| \`${name}\` | ${counts.get(name) ?? 0} | ${t.pk.join(', ') || '—'} | ${refs} |`;
    }),
    '',
    '## Views',
    '',
    ...views.map((v) => `- \`${v}\``),
    ''
  );

  await writeFile(outFile, doc.join('\n'));
  console.log(`[er] wrote ${path.relative(process.cwd(), outFile)}: ${all.length} tables, ${fkCount} foreign keys, ${views.length} views`);
}

main()
  .catch((err) => {
    console.error('[er] error:', err.message);
    process.exitCode = 1;
  })
  .finally(() => closePool());
