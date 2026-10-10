from collections.abc import Iterator
from contextlib import contextmanager

from pgvector.psycopg import register_vector
from psycopg import Connection
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.core.config import Settings


def create_pool(settings: Settings) -> ConnectionPool:
    def configure(conn: Connection) -> None:
        register_vector(conn)
        conn.row_factory = dict_row

    return ConnectionPool(
        conninfo=settings.database_url,
        min_size=1,
        max_size=10,
        kwargs={"autocommit": False},
        configure=configure,
        open=True,
    )


@contextmanager
def get_connection(pool: ConnectionPool) -> Iterator[Connection]:
    with pool.connection() as conn:
        yield conn
