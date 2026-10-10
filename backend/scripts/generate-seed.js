#!/usr/bin/env node
/**
 * Expands the hand-written catalogue (db/seed/products.csv) to roughly 300
 * products by generating realistic variants per category, plus inventory for
 * every store. Output is deterministic (seeded PRNG), so re-running produces
 * the same files and the result is committed:
 *
 *   db/seed/products_generated.csv
 *   db/seed/inventory_generated.csv
 *
 *   npm run db:generate     regenerate after editing the tables below
 *   npm run db:seed         loads the hand-written and generated files together
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';

const here = path.dirname(fileURLToPath(import.meta.url));
const seedDir = path.join(here, '..', 'db', 'seed');

// Brand ids from db/seed/brands.csv
const B = {
  Samsung: 'B01', Apple: 'B02', Dell: 'B03', Lenovo: 'B04', LG: 'B05', Sony: 'B06',
  Whirlpool: 'B07', Nike: 'B08', HP: 'B09', OnePlus: 'B10', Voltas: 'B11', Philips: 'B12',
  boAt: 'B13', NovaMart: 'B14', Levis: 'B15', Prestige: 'B16', Xiaomi: 'B17', Realme: 'B18',
  Motorola: 'B19', Asus: 'B20', Acer: 'B21', TCL: 'B22', JBL: 'B23', Haier: 'B24',
  Bosch: 'B25', Daikin: 'B26', BlueStar: 'B27', Bajaj: 'B28', Adidas: 'B29', Puma: 'B30',
  Bata: 'B31', AllenSolly: 'B32', Tata: 'B33', Nescafe: 'B34',
};

/**
 * Each line: [brand, name template, base price, description, keywords, base specs, variants]
 * A variant is [label, price added to base, extra specs]. "{v}" in the name is
 * replaced by the variant label; without it the label is appended in brackets.
 */
const CATALOGUE = {
  // ------------------------------------------------------------- Mobiles
  C0101: {
    warranty: 12,
    lines: [
      [B.Samsung, 'Galaxy A55 5G', 39999, 'Mid-range 5G phone with a 120 Hz Super AMOLED display and a 50 MP OIS camera.', 'smartphone,android,5g,amoled', { display: '6.6 inch Super AMOLED', battery: '5000 mAh', camera: '50 MP triple', '5g': true },
        [['8 GB, 128 GB', 0, { ram: '8 GB', storage: '128 GB' }], ['8 GB, 256 GB', 3000, { ram: '8 GB', storage: '256 GB' }], ['12 GB, 256 GB', 6000, { ram: '12 GB', storage: '256 GB' }]]],
      [B.Samsung, 'Galaxy S24 Ultra 5G', 129999, 'Flagship with a titanium frame, built-in S Pen and a 200 MP camera.', 'smartphone,android,5g,flagship,s pen', { display: '6.8 inch QHD+ AMOLED', battery: '5000 mAh', camera: '200 MP quad', ram: '12 GB', '5g': true },
        [['256 GB', 0, { storage: '256 GB' }], ['512 GB', 10000, { storage: '512 GB' }]]],
      [B.Apple, 'iPhone 15 Pro', 134900, 'Titanium iPhone with the A17 Pro chip, 48 MP main camera and Action button.', 'iphone,ios,5g,premium,flagship', { display: '6.1 inch Super Retina XDR', camera: '48 MP triple', ram: '8 GB', '5g': true },
        [['128 GB', 0, { storage: '128 GB' }], ['256 GB', 10000, { storage: '256 GB' }], ['512 GB', 30000, { storage: '512 GB' }]]],
      [B.Apple, 'iPhone 14', 59900, 'Apple iPhone 14 with the A15 Bionic chip and a dual 12 MP camera system.', 'iphone,ios,5g', { display: '6.1 inch Super Retina XDR', camera: '12 MP dual', ram: '6 GB', '5g': true },
        [['128 GB', 0, { storage: '128 GB' }], ['256 GB', 10000, { storage: '256 GB' }]]],
      [B.OnePlus, 'OnePlus Nord CE4 5G', 24999, 'Fast and light 5G phone with 100W SuperVOOC charging.', 'smartphone,android,5g,fast charging', { display: '6.7 inch AMOLED', battery: '5500 mAh', camera: '50 MP dual', '5g': true },
        [['8 GB, 128 GB', 0, { ram: '8 GB', storage: '128 GB' }], ['8 GB, 256 GB', 2000, { ram: '8 GB', storage: '256 GB' }]]],
      [B.OnePlus, 'OnePlus 12 5G', 64999, 'Snapdragon 8 Gen 3 flagship with a Hasselblad-tuned camera.', 'smartphone,android,5g,flagship,gaming', { display: '6.82 inch LTPO AMOLED', battery: '5400 mAh', camera: '50 MP triple', '5g': true },
        [['12 GB, 256 GB', 0, { ram: '12 GB', storage: '256 GB' }], ['16 GB, 512 GB', 5000, { ram: '16 GB', storage: '512 GB' }]]],
      [B.Xiaomi, 'Redmi Note 13 Pro 5G', 23999, 'A 200 MP camera and a 1.5K curved AMOLED display at a mid-range price.', 'smartphone,android,5g,camera', { display: '6.67 inch AMOLED', battery: '5100 mAh', camera: '200 MP triple', '5g': true },
        [['8 GB, 128 GB', 0, { ram: '8 GB', storage: '128 GB' }], ['8 GB, 256 GB', 2000, { ram: '8 GB', storage: '256 GB' }], ['12 GB, 256 GB', 4000, { ram: '12 GB', storage: '256 GB' }]]],
      [B.Xiaomi, 'Redmi 13C', 8999, 'Entry-level phone with a large 90 Hz display and a 5000 mAh battery.', 'budget smartphone,android,long battery', { display: '6.74 inch HD+', battery: '5000 mAh', camera: '50 MP dual', '5g': false },
        [['4 GB, 128 GB', 0, { ram: '4 GB', storage: '128 GB' }], ['6 GB, 128 GB', 1000, { ram: '6 GB', storage: '128 GB' }]]],
      [B.Realme, 'realme Narzo 70 5G', 15999, 'Slim 5G phone with a 120 Hz AMOLED display and 45W charging.', 'budget smartphone,android,5g', { display: '6.67 inch AMOLED', battery: '5000 mAh', camera: '50 MP dual', '5g': true },
        [['6 GB, 128 GB', 0, { ram: '6 GB', storage: '128 GB' }], ['8 GB, 128 GB', 1000, { ram: '8 GB', storage: '128 GB' }]]],
      [B.Motorola, 'moto g85 5G', 17999, 'Curved pOLED display, clean Android and a 50 MP OIS camera.', 'smartphone,android,5g,stock android', { display: '6.67 inch pOLED', battery: '5000 mAh', camera: '50 MP dual', '5g': true },
        [['8 GB, 128 GB', 0, { ram: '8 GB', storage: '128 GB' }], ['12 GB, 256 GB', 2000, { ram: '12 GB', storage: '256 GB' }]]],
    ],
  },
  // ------------------------------------------------------------- Laptops
  C0102: {
    warranty: 12,
    lines: [
      [B.Dell, 'Inspiron 15', 52990, 'Everyday 15.6-inch laptop for office work, browsing and study.', 'laptop,windows,office,student', { display: '15.6 inch FHD', os: 'Windows 11', weight: '1.65 kg' },
        [['i3, 8 GB, 512 GB', 0, { processor: 'Intel Core i3', ram: '8 GB', storage: '512 GB SSD' }], ['i5, 16 GB, 512 GB', 14000, { processor: 'Intel Core i5', ram: '16 GB', storage: '512 GB SSD' }], ['i7, 16 GB, 1 TB', 30000, { processor: 'Intel Core i7', ram: '16 GB', storage: '1 TB SSD' }]]],
      [B.Dell, 'Vostro 14', 45990, 'Compact business laptop with a spill-resistant keyboard.', 'laptop,windows,business,office', { display: '14 inch FHD', os: 'Windows 11 Pro', weight: '1.54 kg' },
        [['i3, 8 GB, 256 GB', 0, { processor: 'Intel Core i3', ram: '8 GB', storage: '256 GB SSD' }], ['i5, 16 GB, 512 GB', 15000, { processor: 'Intel Core i5', ram: '16 GB', storage: '512 GB SSD' }]]],
      [B.Lenovo, 'IdeaPad Slim 5', 62990, 'Thin metal laptop with an OLED display and all-day battery life.', 'laptop,windows,student,programming,lightweight', { display: '14 inch WUXGA OLED', os: 'Windows 11', weight: '1.46 kg' },
        [['Ryzen 5, 16 GB, 512 GB', 0, { processor: 'AMD Ryzen 5', ram: '16 GB', storage: '512 GB SSD' }], ['Ryzen 7, 16 GB, 1 TB', 12000, { processor: 'AMD Ryzen 7', ram: '16 GB', storage: '1 TB SSD' }]]],
      [B.Lenovo, 'ThinkPad X1 Carbon Gen 12', 164990, 'Flagship business ultrabook with a legendary keyboard, built for developers on the move.', 'laptop,developer,java development,programming,business,linux', { display: '14 inch 2.8K OLED', os: 'Windows 11 Pro', weight: '1.09 kg' },
        [['Ultra 5, 16 GB, 512 GB', 0, { processor: 'Intel Core Ultra 5', ram: '16 GB', storage: '512 GB SSD' }], ['Ultra 7, 32 GB, 1 TB', 30000, { processor: 'Intel Core Ultra 7', ram: '32 GB', storage: '1 TB SSD' }]]],
      [B.HP, 'HP 15s', 41990, 'Lightweight everyday laptop with a micro-edge display.', 'laptop,windows,student,office', { display: '15.6 inch FHD', os: 'Windows 11', weight: '1.59 kg' },
        [['i3, 8 GB, 512 GB', 0, { processor: 'Intel Core i3', ram: '8 GB', storage: '512 GB SSD' }], ['i5, 16 GB, 512 GB', 12000, { processor: 'Intel Core i5', ram: '16 GB', storage: '512 GB SSD' }]]],
      [B.HP, 'Victus 15 Gaming', 68990, 'Entry gaming laptop with a 144 Hz display and dedicated RTX graphics.', 'gaming laptop,windows,rtx,144hz', { display: '15.6 inch FHD 144 Hz', os: 'Windows 11', weight: '2.29 kg' },
        [['i5, 16 GB, RTX 3050', 0, { processor: 'Intel Core i5', ram: '16 GB', storage: '512 GB SSD', graphics: 'RTX 3050 6 GB' }], ['Ryzen 7, 16 GB, RTX 4060', 25000, { processor: 'AMD Ryzen 7', ram: '16 GB', storage: '1 TB SSD', graphics: 'RTX 4060 8 GB' }]]],
      [B.Apple, 'MacBook Pro 14 M3', 169900, 'Pro laptop with a Liquid Retina XDR display - a favourite for software development and creative work.', 'laptop,macos,developer,java development,programming,creator', { display: '14.2 inch Liquid Retina XDR', os: 'macOS', weight: '1.55 kg' },
        [['M3, 8 GB, 512 GB', 0, { processor: 'Apple M3', ram: '8 GB unified', storage: '512 GB SSD' }], ['M3 Pro, 18 GB, 512 GB', 30000, { processor: 'Apple M3 Pro', ram: '18 GB unified', storage: '512 GB SSD' }], ['M3 Pro, 18 GB, 1 TB', 50000, { processor: 'Apple M3 Pro', ram: '18 GB unified', storage: '1 TB SSD' }]]],
      [B.Apple, 'MacBook Air 15 M3', 134900, 'Big-screen MacBook Air - fanless, thin and quiet.', 'laptop,macos,student,lightweight', { display: '15.3 inch Liquid Retina', os: 'macOS', weight: '1.51 kg', processor: 'Apple M3' },
        [['8 GB, 256 GB', 0, { ram: '8 GB unified', storage: '256 GB SSD' }], ['16 GB, 512 GB', 30000, { ram: '16 GB unified', storage: '512 GB SSD' }]]],
      [B.Asus, 'Vivobook 16', 47990, 'Large 16-inch laptop for multitasking with a full numeric keypad.', 'laptop,windows,office,student', { display: '16 inch WUXGA', os: 'Windows 11', weight: '1.88 kg' },
        [['i3, 8 GB, 512 GB', 0, { processor: 'Intel Core i3', ram: '8 GB', storage: '512 GB SSD' }], ['i5, 16 GB, 512 GB', 12000, { processor: 'Intel Core i5', ram: '16 GB', storage: '512 GB SSD' }]]],
      [B.Asus, 'ROG Strix G16', 124990, 'High-refresh gaming laptop with tri-fan cooling.', 'gaming laptop,windows,rtx,165hz', { display: '16 inch QHD+ 165 Hz', os: 'Windows 11', weight: '2.5 kg' },
        [['i7, 16 GB, RTX 4060', 0, { processor: 'Intel Core i7', ram: '16 GB', storage: '1 TB SSD', graphics: 'RTX 4060 8 GB' }], ['i9, 32 GB, RTX 4070', 40000, { processor: 'Intel Core i9', ram: '32 GB', storage: '1 TB SSD', graphics: 'RTX 4070 8 GB' }]]],
      [B.Acer, 'Aspire Lite', 33990, 'Budget laptop with a metal body for classes and everyday tasks.', 'budget laptop,windows,student', { display: '15.6 inch FHD', os: 'Windows 11', weight: '1.59 kg' },
        [['Ryzen 3, 8 GB, 512 GB', 0, { processor: 'AMD Ryzen 3', ram: '8 GB', storage: '512 GB SSD' }], ['Ryzen 5, 16 GB, 512 GB', 7000, { processor: 'AMD Ryzen 5', ram: '16 GB', storage: '512 GB SSD' }]]],
      [B.Acer, 'Swift Go 14 OLED', 74990, 'Ultralight OLED laptop with Intel Core Ultra and AI features.', 'laptop,windows,lightweight,programming,oled', { display: '14 inch 2.8K OLED', os: 'Windows 11', weight: '1.32 kg' },
        [['Ultra 5, 16 GB, 512 GB', 0, { processor: 'Intel Core Ultra 5', ram: '16 GB', storage: '512 GB SSD' }], ['Ultra 7, 16 GB, 1 TB', 14000, { processor: 'Intel Core Ultra 7', ram: '16 GB', storage: '1 TB SSD' }]]],
    ],
  },
  // --------------------------------------------------------- Televisions
  C0103: {
    warranty: 24,
    lines: [
      [B.Samsung, '{v} Crystal 4K Vivid Pro Smart TV', 32990, 'Crystal 4K processor with PurColor and built-in voice assistants.', 'tv,4k,smart tv,led', { resolution: '4K UHD', panel: 'LED', os: 'Tizen', hdmiPorts: 3 },
        [['43 inch', 0, { screenSize: '43 inch' }], ['55 inch', 12000, { screenSize: '55 inch' }], ['65 inch', 32000, { screenSize: '65 inch' }]]],
      [B.Samsung, '{v} Neo QLED 4K Smart TV', 99990, 'Mini LED backlight with Quantum Matrix technology for deep contrast.', 'tv,4k,smart tv,qled,mini led', { resolution: '4K UHD', panel: 'Neo QLED', os: 'Tizen', hdmiPorts: 4 },
        [['55 inch', 0, { screenSize: '55 inch' }], ['65 inch', 40000, { screenSize: '65 inch' }], ['75 inch', 110000, { screenSize: '75 inch' }]]],
      [B.LG, '{v} UHD AI ThinQ 4K Smart TV', 30990, 'webOS smart TV with an a5 AI processor and Magic Remote support.', 'tv,4k,smart tv,led,webos', { resolution: '4K UHD', panel: 'LED', os: 'webOS', hdmiPorts: 3 },
        [['43 inch', 0, { screenSize: '43 inch' }], ['55 inch', 13000, { screenSize: '55 inch' }], ['65 inch', 34000, { screenSize: '65 inch' }]]],
      [B.LG, '{v} OLED evo C4 4K Smart TV', 129990, 'Self-lit OLED pixels with a 144 Hz panel - built for films and gaming.', 'tv,4k,smart tv,oled,gaming', { resolution: '4K UHD', panel: 'OLED evo', os: 'webOS', hdmiPorts: 4 },
        [['55 inch', 0, { screenSize: '55 inch' }], ['65 inch', 60000, { screenSize: '65 inch' }], ['77 inch', 190000, { screenSize: '77 inch' }]]],
      [B.Sony, '{v} Bravia 2 4K Google TV', 39990, 'Sony 4K Processor X1 with Google TV and Dolby Audio.', 'tv,4k,smart tv,led,google tv', { resolution: '4K UHD', panel: 'LED', os: 'Google TV', hdmiPorts: 3 },
        [['43 inch', 0, { screenSize: '43 inch' }], ['50 inch', 10000, { screenSize: '50 inch' }], ['55 inch', 18000, { screenSize: '55 inch' }], ['65 inch', 40000, { screenSize: '65 inch' }]]],
      [B.Sony, '{v} Bravia XR A80L OLED Google TV', 169990, 'Cognitive Processor XR with Acoustic Surface Audio+.', 'tv,4k,smart tv,oled,google tv', { resolution: '4K UHD', panel: 'OLED', os: 'Google TV', hdmiPorts: 4 },
        [['55 inch', 0, { screenSize: '55 inch' }], ['65 inch', 70000, { screenSize: '65 inch' }]]],
      [B.Xiaomi, '{v} Smart TV X Series 4K', 26999, 'Bezel-less 4K TV with Dolby Vision and 30W speakers.', 'tv,4k,smart tv,led,budget tv', { resolution: '4K UHD', panel: 'LED', os: 'Google TV', hdmiPorts: 3 },
        [['43 inch', 0, { screenSize: '43 inch' }], ['50 inch', 6000, { screenSize: '50 inch' }], ['55 inch', 11000, { screenSize: '55 inch' }]]],
      [B.TCL, '{v} HD Ready Android Smart TV', 11990, 'Compact smart TV for bedrooms with built-in Chromecast.', 'tv,smart tv,led,budget tv', { resolution: 'HD Ready', panel: 'LED', os: 'Android TV', hdmiPorts: 2 },
        [['32 inch', 0, { screenSize: '32 inch' }], ['40 inch', 6000, { screenSize: '40 inch', resolution: 'Full HD' }]]],
    ],
  },
  // --------------------------------------------------------------- Audio
  C0104: {
    warranty: 12,
    lines: [
      [B.boAt, 'Airdopes 141 ANC Earbuds', 1499, 'True wireless earbuds with active noise cancellation and 42 hours of playback.', 'earbuds,tws,bluetooth,anc', { type: 'True wireless', playback: '42 hours', anc: true },
        [['Black', 0, { colour: 'Black' }], ['White', 0, { colour: 'White' }], ['Blue', 100, { colour: 'Blue' }]]],
      [B.boAt, 'Stone 1200 Bluetooth Speaker', 3999, '14W portable speaker with RGB lights and IPX7 water resistance.', 'speaker,bluetooth,portable,party', { type: 'Portable speaker', output: '14 W', playback: '9 hours' },
        [['Black', 0, { colour: 'Black' }], ['Blue', 0, { colour: 'Blue' }]]],
      [B.boAt, 'Rockerz 255 Pro+ Neckband', 1199, 'Wireless neckband with fast charge - 10 minutes for 10 hours.', 'neckband,bluetooth,earphones', { type: 'Neckband', playback: '60 hours', anc: false },
        [['Black', 0, { colour: 'Black' }], ['Teal', 0, { colour: 'Teal' }], ['Red', 0, { colour: 'Red' }]]],
      [B.Sony, 'WH-CH720N Wireless Headphones', 9990, 'Lightweight over-ear headphones with noise cancelling and 35-hour battery.', 'headphones,bluetooth,noise cancelling,over ear', { type: 'Over-ear', playback: '35 hours', anc: true },
        [['Black', 0, { colour: 'Black' }], ['Blue', 0, { colour: 'Blue' }], ['White', 0, { colour: 'White' }]]],
      [B.Sony, 'WF-1000XM5 Earbuds', 24990, 'Flagship noise cancelling earbuds with Hi-Res Audio Wireless.', 'earbuds,tws,noise cancelling,premium', { type: 'True wireless', playback: '24 hours', anc: true },
        [['Black', 0, { colour: 'Black' }], ['Silver', 0, { colour: 'Silver' }]]],
      [B.Sony, 'HT-S20R 5.1 Soundbar', 15990, 'Real 5.1 channel surround with a wired subwoofer and rear speakers.', 'soundbar,home theatre,dolby', { type: 'Soundbar', output: '400 W', channels: '5.1' }, [['', 0, {}]]],
      [B.JBL, 'Flip 6 Portable Speaker', 9999, 'Bold JBL sound in a waterproof, dustproof body.', 'speaker,bluetooth,portable,waterproof', { type: 'Portable speaker', output: '30 W', playback: '12 hours' },
        [['Black', 0, { colour: 'Black' }], ['Blue', 0, { colour: 'Blue' }], ['Red', 0, { colour: 'Red' }]]],
      [B.JBL, 'Tune 770NC Headphones', 5999, 'Adaptive noise cancelling headphones with JBL Pure Bass.', 'headphones,bluetooth,noise cancelling,over ear', { type: 'Over-ear', playback: '70 hours', anc: true },
        [['Black', 0, { colour: 'Black' }], ['White', 0, { colour: 'White' }]]],
      [B.JBL, 'Bar 2.1 Deep Bass Soundbar', 24999, '300W soundbar with a wireless subwoofer and Dolby Digital.', 'soundbar,home theatre,dolby,subwoofer', { type: 'Soundbar', output: '300 W', channels: '2.1' }, [['', 0, {}]]],
      [B.Apple, 'AirPods Pro (2nd generation)', 24900, 'Active noise cancellation, Adaptive Audio and a USB-C MagSafe case.', 'earbuds,tws,noise cancelling,ios', { type: 'True wireless', playback: '30 hours', anc: true }, [['', 0, {}]]],
      [B.Apple, 'AirPods (3rd generation)', 19900, 'Spatial audio with dynamic head tracking and sweat resistance.', 'earbuds,tws,ios', { type: 'True wireless', playback: '30 hours', anc: false }, [['', 0, {}]]],
      [B.Samsung, 'Galaxy Buds FE', 6999, 'Comfortable wing-tip earbuds with active noise cancelling.', 'earbuds,tws,noise cancelling,android', { type: 'True wireless', playback: '30 hours', anc: true },
        [['Graphite', 0, { colour: 'Graphite' }], ['White', 0, { colour: 'White' }]]],
      [B.OnePlus, 'OnePlus Buds 3', 5499, 'Dual drivers with 49 dB noise cancellation.', 'earbuds,tws,noise cancelling,android', { type: 'True wireless', playback: '44 hours', anc: true },
        [['Metallic Gray', 0, { colour: 'Metallic Gray' }], ['Splendid Blue', 0, { colour: 'Splendid Blue' }]]],
    ],
  },
  // ------------------------------------------------------- Refrigerators
  C0201: {
    warranty: 12,
    lines: [
      [B.LG, '{v} Frost Free Double Door Refrigerator', 26990, 'Smart Inverter compressor with door cooling and a convertible freezer.', 'fridge,refrigerator,double door,frost free,inverter', { type: 'Double door', energyRating: '3 Star', compressor: 'Smart Inverter' },
        [['242 L', 0, { capacity: '242 L' }], ['272 L', 4000, { capacity: '272 L' }], ['343 L', 12000, { capacity: '343 L' }]]],
      [B.LG, '{v} Direct Cool Single Door Refrigerator', 16490, 'Fast ice making and a base stand with drawer.', 'fridge,refrigerator,single door,direct cool', { type: 'Single door', energyRating: '4 Star', compressor: 'Smart Inverter' },
        [['185 L', 0, { capacity: '185 L' }], ['201 L', 2000, { capacity: '201 L' }]]],
      [B.Samsung, '{v} Convertible 5-in-1 Double Door Refrigerator', 25990, 'Five conversion modes with Twin Cooling Plus.', 'fridge,refrigerator,double door,convertible,inverter', { type: 'Double door', energyRating: '3 Star', compressor: 'Digital Inverter' },
        [['236 L', 0, { capacity: '236 L' }], ['256 L', 3000, { capacity: '256 L' }], ['322 L', 11000, { capacity: '322 L' }]]],
      [B.Samsung, '{v} French Door Refrigerator', 84990, 'Large-capacity French door design with a water and ice dispenser.', 'fridge,refrigerator,french door,premium', { type: 'French door', energyRating: '3 Star', compressor: 'Digital Inverter' },
        [['550 L', 0, { capacity: '550 L' }], ['653 L', 25000, { capacity: '653 L' }]]],
      [B.Whirlpool, '{v} Intellifresh Double Door Refrigerator', 24490, 'Up to 12 days of garden freshness with 6th Sense technology.', 'fridge,refrigerator,double door,frost free', { type: 'Double door', energyRating: '2 Star', compressor: 'Intellisense Inverter' },
        [['235 L', 0, { capacity: '235 L' }], ['265 L', 3500, { capacity: '265 L' }], ['327 L', 10000, { capacity: '327 L' }]]],
      [B.Whirlpool, '{v} Icemagic Pro Single Door Refrigerator', 14990, 'Insulated capillary technology keeps food cold through power cuts.', 'fridge,refrigerator,single door,direct cool,budget', { type: 'Single door', energyRating: '3 Star', compressor: 'Reciprocatory' },
        [['184 L', 0, { capacity: '184 L' }], ['192 L', 1000, { capacity: '192 L' }], ['207 L', 2500, { capacity: '207 L' }]]],
      [B.Haier, '{v} Bottom Mount Refrigerator', 27990, 'Fridge on top, freezer below - less bending for everyday use.', 'fridge,refrigerator,bottom mount,frost free', { type: 'Bottom mount', energyRating: '3 Star', compressor: 'Triple Inverter' },
        [['237 L', 0, { capacity: '237 L' }], ['325 L', 9000, { capacity: '325 L' }]]],
      [B.Haier, '{v} Side-by-Side Refrigerator', 64990, 'Expert Inverter technology with a magic convertible zone.', 'fridge,refrigerator,side by side,premium', { type: 'Side-by-side', energyRating: '3 Star', compressor: 'Expert Inverter' },
        [['596 L', 0, { capacity: '596 L' }], ['602 L', 8000, { capacity: '602 L' }]]],
      [B.Bosch, '{v} Triple Door Refrigerator', 39990, 'Separate vegetable drawer compartment with VitaFresh.', 'fridge,refrigerator,triple door,frost free', { type: 'Triple door', energyRating: '3 Star', compressor: 'Inverter' },
        [['332 L', 0, { capacity: '332 L' }], ['364 L', 5000, { capacity: '364 L' }]]],
    ],
  },
  // ---------------------------------------------------- Washing Machines
  C0202: {
    warranty: 24,
    lines: [
      [B.LG, '{v} AI Direct Drive Front Load Washing Machine', 31990, 'AI fabric sensing with steam wash and a 10-year motor warranty.', 'washing machine,front load,fully automatic,inverter,steam', { type: 'Front load', energyRating: '5 Star', spinSpeed: '1200 rpm' },
        [['7 kg', 0, { capacity: '7 kg' }], ['8 kg', 5000, { capacity: '8 kg' }], ['9 kg', 11000, { capacity: '9 kg' }]]],
      [B.LG, '{v} Smart Inverter Top Load Washing Machine', 17990, 'TurboDrum wash with a smart inverter motor.', 'washing machine,top load,fully automatic,inverter', { type: 'Top load', energyRating: '5 Star', spinSpeed: '740 rpm' },
        [['7 kg', 0, { capacity: '7 kg' }], ['8 kg', 3000, { capacity: '8 kg' }]]],
      [B.Samsung, '{v} EcoBubble Front Load Washing Machine', 29990, 'EcoBubble technology washes effectively even in cool water.', 'washing machine,front load,fully automatic,inverter', { type: 'Front load', energyRating: '5 Star', spinSpeed: '1200 rpm' },
        [['7 kg', 0, { capacity: '7 kg' }], ['8 kg', 5000, { capacity: '8 kg' }], ['9 kg', 12000, { capacity: '9 kg' }]]],
      [B.Samsung, '{v} Fully Automatic Top Load Washing Machine', 15990, 'Diamond drum with a soft-closing lid.', 'washing machine,top load,fully automatic', { type: 'Top load', energyRating: '5 Star', spinSpeed: '700 rpm' },
        [['6.5 kg', 0, { capacity: '6.5 kg' }], ['7 kg', 1500, { capacity: '7 kg' }], ['8 kg', 4000, { capacity: '8 kg' }]]],
      [B.Whirlpool, '{v} Stainwash Pro Top Load Washing Machine', 16490, 'In-built heater removes up to 48-hour-old stains.', 'washing machine,top load,fully automatic,heater', { type: 'Top load', energyRating: '5 Star', spinSpeed: '740 rpm' },
        [['6.5 kg', 0, { capacity: '6.5 kg' }], ['7.5 kg', 2500, { capacity: '7.5 kg' }]]],
      [B.Whirlpool, '{v} Ace Semi Automatic Washing Machine', 9990, 'Twin tub washer with a 1400 rpm spin motor.', 'washing machine,semi automatic,top load,budget', { type: 'Semi automatic', energyRating: '5 Star', spinSpeed: '1400 rpm' },
        [['7 kg', 0, { capacity: '7 kg' }], ['8 kg', 1500, { capacity: '8 kg' }], ['9 kg', 3000, { capacity: '9 kg' }]]],
      [B.Bosch, '{v} Series 6 Front Load Washing Machine', 33990, 'Anti-vibration design with an EcoSilence Drive motor.', 'washing machine,front load,fully automatic,quiet', { type: 'Front load', energyRating: '5 Star', spinSpeed: '1400 rpm' },
        [['7 kg', 0, { capacity: '7 kg' }], ['8 kg', 5000, { capacity: '8 kg' }], ['9 kg', 12000, { capacity: '9 kg' }]]],
      [B.Haier, '{v} Semi Automatic Twin Tub Washing Machine', 9490, 'Vortex pulsator with a rust-free plastic body.', 'washing machine,semi automatic,budget', { type: 'Semi automatic', energyRating: '5 Star', spinSpeed: '1300 rpm' },
        [['7 kg', 0, { capacity: '7 kg' }], ['8.5 kg', 2000, { capacity: '8.5 kg' }]]],
    ],
  },
  // ---------------------------------------------------- Air Conditioners
  C0203: {
    warranty: 12,
    lines: [
      [B.Voltas, '{v} 3 Star Inverter Split AC', 29990, 'Adjustable cooling modes with a copper condenser.', 'ac,air conditioner,split ac,inverter', { type: 'Split', energyRating: '3 Star', condenser: 'Copper' },
        [['1 Ton', 0, { capacity: '1 Ton' }], ['1.5 Ton', 4000, { capacity: '1.5 Ton' }], ['2 Ton', 12000, { capacity: '2 Ton' }]]],
      [B.Voltas, '{v} 5 Star Inverter Split AC', 36990, 'Top energy rating for lower running costs through summer.', 'ac,air conditioner,split ac,inverter,energy saving', { type: 'Split', energyRating: '5 Star', condenser: 'Copper' },
        [['1 Ton', 0, { capacity: '1 Ton' }], ['1.5 Ton', 6000, { capacity: '1.5 Ton' }]]],
      [B.Voltas, '{v} 3 Star Window AC', 27990, 'Turbo cooling window AC with an anti-dust filter.', 'ac,air conditioner,window ac', { type: 'Window', energyRating: '3 Star', condenser: 'Copper' }, [['1.5 Ton', 0, { capacity: '1.5 Ton' }]]],
      [B.LG, '{v} 5 Star Dual Inverter Split AC', 38990, 'AI convertible 6-in-1 cooling with a HD filter.', 'ac,air conditioner,split ac,inverter,energy saving', { type: 'Split', energyRating: '5 Star', condenser: 'Copper' },
        [['1 Ton', 0, { capacity: '1 Ton' }], ['1.5 Ton', 7000, { capacity: '1.5 Ton' }], ['2 Ton', 19000, { capacity: '2 Ton' }]]],
      [B.Samsung, '{v} WindFree Inverter Split AC', 41990, 'WindFree cooling without direct cold drafts.', 'ac,air conditioner,split ac,inverter,windfree', { type: 'Split', energyRating: '5 Star', condenser: 'Copper' },
        [['1 Ton', 0, { capacity: '1 Ton' }], ['1.5 Ton', 6000, { capacity: '1.5 Ton' }]]],
      [B.Daikin, '{v} 3 Star Inverter Split AC', 33990, 'Dew Clean technology and PM 2.5 filter.', 'ac,air conditioner,split ac,inverter', { type: 'Split', energyRating: '3 Star', condenser: 'Copper' },
        [['1 Ton', 0, { capacity: '1 Ton' }], ['1.5 Ton', 5000, { capacity: '1.5 Ton' }], ['1.8 Ton', 13000, { capacity: '1.8 Ton' }]]],
      [B.Daikin, '{v} 5 Star Inverter Split AC', 42990, 'Triple display with 3D airflow and high ambient cooling up to 54 C.', 'ac,air conditioner,split ac,inverter,energy saving', { type: 'Split', energyRating: '5 Star', condenser: 'Copper' },
        [['1 Ton', 0, { capacity: '1 Ton' }], ['1.5 Ton', 8000, { capacity: '1.5 Ton' }]]],
      [B.BlueStar, '{v} 3 Star Inverter Split AC', 30990, 'Convertible 5-in-1 cooling with self-clean.', 'ac,air conditioner,split ac,inverter', { type: 'Split', energyRating: '3 Star', condenser: 'Copper' },
        [['1 Ton', 0, { capacity: '1 Ton' }], ['1.5 Ton', 4500, { capacity: '1.5 Ton' }], ['2 Ton', 13000, { capacity: '2 Ton' }]]],
      [B.BlueStar, '{v} 5 Star Window AC', 31990, 'Efficient window AC with a hydrophilic blue fin coating.', 'ac,air conditioner,window ac,energy saving', { type: 'Window', energyRating: '5 Star', condenser: 'Copper' },
        [['1 Ton', 0, { capacity: '1 Ton' }], ['1.5 Ton', 5000, { capacity: '1.5 Ton' }]]],
      [B.Haier, '{v} Kinouchi Inverter Split AC', 32990, 'Frost self-clean with intelligent convertible modes.', 'ac,air conditioner,split ac,inverter', { type: 'Split', energyRating: '4 Star', condenser: 'Copper' },
        [['1 Ton', 0, { capacity: '1 Ton' }], ['1.5 Ton', 5000, { capacity: '1.5 Ton' }]]],
    ],
  },
  // -------------------------------------------------- Kitchen Appliances
  C0204: {
    warranty: 24,
    lines: [
      [B.Philips, 'Air Fryer {v}', 7999, 'Rapid Air technology for frying with up to 90% less fat.', 'air fryer,kitchen,healthy cooking', { power: '1400 W' },
        [['4.1 L', 0, { capacity: '4.1 L' }], ['6.2 L XL', 5000, { capacity: '6.2 L', power: '2000 W' }]]],
      [B.Philips, 'Mixer Grinder {v}', 3299, 'Three leak-proof jars with a turbo motor.', 'mixer grinder,kitchen', { jars: 3 },
        [['500 W', 0, { power: '500 W' }], ['750 W', 1200, { power: '750 W' }]]],
      [B.Philips, 'Hand Blender {v}', 1699, 'ProMix blending rod for soups, purees and shakes.', 'hand blender,kitchen', {},
        [['250 W', 0, { power: '250 W' }], ['650 W', 1800, { power: '650 W' }]]],
      [B.Prestige, 'Induction Cooktop {v}', 2199, 'Automatic voltage regulator with Indian menu presets.', 'induction,cooktop,kitchen', { presets: 8 },
        [['1200 W', 0, { power: '1200 W' }], ['1600 W', 500, { power: '1600 W' }], ['2000 W', 1100, { power: '2000 W' }]]],
      [B.Prestige, 'Svachh Pressure Cooker {v}', 1899, 'Deep lid controls spillage - induction and gas compatible.', 'pressure cooker,cookware,kitchen', { material: 'Hard anodised aluminium' },
        [['3 L', 0, { capacity: '3 L' }], ['5 L', 700, { capacity: '5 L' }], ['7.5 L', 1500, { capacity: '7.5 L' }]]],
      [B.Prestige, 'Electric Rice Cooker {v}', 2499, 'Keep-warm mode with a detachable power cord.', 'rice cooker,kitchen', {},
        [['1 L', 0, { capacity: '1 L', power: '400 W' }], ['1.8 L', 700, { capacity: '1.8 L', power: '700 W' }]]],
      [B.Bajaj, 'Rex Mixer Grinder {v}', 2299, 'Multi-function blades with a 2-year warranty.', 'mixer grinder,kitchen,budget', { jars: 3 },
        [['500 W', 0, { power: '500 W' }], ['750 W', 900, { power: '750 W' }]]],
      [B.Bajaj, 'Oven Toaster Grill {v}', 4499, 'OTG with a motorised rotisserie and baking tray.', 'otg,oven,baking,kitchen', {},
        [['16 L', 0, { capacity: '16 L', power: '1200 W' }], ['28 L', 2500, { capacity: '28 L', power: '1500 W' }], ['45 L', 6000, { capacity: '45 L', power: '2000 W' }]]],
      [B.Bajaj, 'Electric Kettle {v}', 899, 'Stainless steel kettle with auto shut-off.', 'kettle,kitchen', { power: '1500 W' },
        [['1.2 L', 0, { capacity: '1.2 L' }], ['1.5 L', 200, { capacity: '1.5 L' }]]],
      [B.Bosch, 'Convection Microwave Oven {v}', 13990, 'Bake, grill and reheat with 10 auto-cook programmes.', 'microwave,oven,convection,kitchen', { type: 'Convection' },
        [['23 L', 0, { capacity: '23 L' }], ['28 L', 3000, { capacity: '28 L' }], ['32 L', 6000, { capacity: '32 L' }]]],
      [B.LG, 'Microwave Oven {v}', 6990, 'i-wave technology for even heating.', 'microwave,oven,kitchen', {},
        [['20 L Solo', 0, { capacity: '20 L', type: 'Solo' }], ['28 L Convection', 9000, { capacity: '28 L', type: 'Convection' }]]],
    ],
  },
  // ------------------------------------------------------------ Footwear
  C0301: {
    warranty: 3,
    lines: [
      [B.Nike, 'Air Max Excee Sneakers', 8695, 'Inspired by the Air Max 90, with a visible Air unit.', 'sneakers,shoes,casual,air max', { closure: 'Lace-up', sole: 'Rubber' },
        [['White', 0, { colour: 'White' }], ['Black', 0, { colour: 'Black' }], ['Grey', 0, { colour: 'Grey' }]]],
      [B.Nike, 'Court Vision Low Sneakers', 5695, 'Retro basketball style for everyday wear.', 'sneakers,shoes,casual', { closure: 'Lace-up', sole: 'Rubber' },
        [['White', 0, { colour: 'White' }], ['Black/White', 0, { colour: 'Black/White' }]]],
      [B.Nike, 'Downshifter 13 Running Shoes', 4295, 'Breathable mesh running shoe with soft cushioning.', 'running shoes,sports,gym', { closure: 'Lace-up', sole: 'Rubber' },
        [['Black', 0, { colour: 'Black' }], ['Blue', 0, { colour: 'Blue' }], ['Grey', 0, { colour: 'Grey' }]]],
      [B.Adidas, 'Ultraboost Light Running Shoes', 18999, 'The lightest Ultraboost, with Light BOOST cushioning.', 'running shoes,sports,premium,marathon', { closure: 'Lace-up', sole: 'Continental rubber' },
        [['Core Black', 0, { colour: 'Core Black' }], ['Cloud White', 0, { colour: 'Cloud White' }]]],
      [B.Adidas, 'Grand Court Sneakers', 4599, 'Tennis-inspired sneakers with the classic 3-Stripes.', 'sneakers,shoes,casual', { closure: 'Lace-up', sole: 'Rubber' },
        [['White', 0, { colour: 'White' }], ['Black', 0, { colour: 'Black' }], ['Navy', 0, { colour: 'Navy' }]]],
      [B.Adidas, 'Adilette Comfort Slides', 1999, 'Cloudfoam footbed slides for after-sport comfort.', 'slides,sandals,casual', { closure: 'Slip-on', sole: 'EVA' },
        [['Black', 0, { colour: 'Black' }], ['Navy', 0, { colour: 'Navy' }]]],
      [B.Puma, 'Softride Enzo Running Shoes', 3999, 'SoftFoam+ sockliner for step-in comfort.', 'running shoes,sports,gym', { closure: 'Slip-on', sole: 'Rubber' },
        [['Black', 0, { colour: 'Black' }], ['Grey', 0, { colour: 'Grey' }], ['Navy', 0, { colour: 'Navy' }]]],
      [B.Puma, 'Smash V2 Sneakers', 3499, 'Tennis-inspired leather sneakers.', 'sneakers,shoes,casual,leather', { closure: 'Lace-up', sole: 'Rubber' },
        [['White', 0, { colour: 'White' }], ['Black', 0, { colour: 'Black' }]]],
      [B.Bata, 'Formal Leather Derby Shoes', 2499, 'Polished leather derby shoes for the office.', 'formal shoes,leather,office', { closure: 'Lace-up', sole: 'TPR' },
        [['Black', 0, { colour: 'Black' }], ['Brown', 0, { colour: 'Brown' }]]],
      [B.Bata, 'Comfit Walking Sandals', 1299, 'Cushioned sandals with adjustable straps.', 'sandals,walking,casual', { closure: 'Velcro', sole: 'PU' },
        [['Black', 0, { colour: 'Black' }], ['Tan', 0, { colour: 'Tan' }]]],
    ],
  },
  // ------------------------------------------------------------- Apparel
  C0302: {
    warranty: null,
    lines: [
      [B.Levis, '512 Slim Taper Jeans', 3299, 'Slim through the thigh with a tapered leg.', 'jeans,denim,men', { fit: 'Slim taper', material: 'Cotton stretch denim' },
        [['Dark Indigo', 0, { colour: 'Dark Indigo' }], ['Mid Blue', 0, { colour: 'Mid Blue' }], ['Black', 200, { colour: 'Black' }]]],
      [B.Levis, 'Trucker Denim Jacket', 4999, 'The original jean jacket since 1967.', 'jacket,denim,winter', { fit: 'Regular', material: 'Cotton denim' },
        [['Mid Blue', 0, { colour: 'Mid Blue' }], ['Black', 0, { colour: 'Black' }]]],
      [B.Levis, 'Graphic Logo T-Shirt', 1199, 'Classic batwing logo tee in soft cotton jersey.', 't-shirt,casual,cotton', { fit: 'Regular', material: 'Cotton' },
        [['White', 0, { colour: 'White' }], ['Black', 0, { colour: 'Black' }], ['Red', 0, { colour: 'Red' }]]],
      [B.Nike, 'Dri-FIT Training T-Shirt', 1795, 'Sweat-wicking fabric that keeps you dry in the gym.', 't-shirt,sports,gym,training', { fit: 'Standard', material: 'Polyester' },
        [['Black', 0, { colour: 'Black' }], ['Royal Blue', 0, { colour: 'Royal Blue' }], ['Grey', 0, { colour: 'Grey' }]]],
      [B.Nike, 'Sportswear Club Fleece Hoodie', 3995, 'Brushed-back fleece hoodie for everyday warmth.', 'hoodie,winter,casual', { fit: 'Standard', material: 'Cotton fleece' },
        [['Black', 0, { colour: 'Black' }], ['Grey Heather', 0, { colour: 'Grey Heather' }]]],
      [B.Adidas, 'Essentials 3-Stripes Track Pants', 2599, 'Tapered track pants with zip pockets.', 'track pants,sports,gym', { fit: 'Tapered', material: 'Recycled polyester' },
        [['Black', 0, { colour: 'Black' }], ['Navy', 0, { colour: 'Navy' }]]],
      [B.Puma, 'Essentials Polo T-Shirt', 1499, 'Pique polo with a ribbed collar.', 'polo,t-shirt,casual', { fit: 'Regular', material: 'Cotton pique' },
        [['Black', 0, { colour: 'Black' }], ['White', 0, { colour: 'White' }], ['Navy', 0, { colour: 'Navy' }]]],
      [B.AllenSolly, 'Slim Fit Formal Shirt', 1799, 'Wrinkle-resistant cotton shirt for the office.', 'shirt,formal,office', { fit: 'Slim', material: 'Cotton' },
        [['White', 0, { colour: 'White' }], ['Light Blue', 0, { colour: 'Light Blue' }], ['Pink', 0, { colour: 'Pink' }]]],
      [B.AllenSolly, 'Stretch Chino Trousers', 2199, 'Smart-casual chinos with a little stretch.', 'trousers,chinos,casual,office', { fit: 'Slim', material: 'Cotton stretch' },
        [['Khaki', 0, { colour: 'Khaki' }], ['Navy', 0, { colour: 'Navy' }]]],
      [B.NovaMart, 'Cotton Round Neck T-Shirt (Pack of 3)', 799, 'Everyday combed-cotton tees - value pack.', 't-shirt,casual,cotton,value pack', { fit: 'Regular', material: 'Combed cotton' },
        [['Assorted Solids', 0, { colour: 'Assorted' }], ['Black', 0, { colour: 'Black' }]]],
    ],
  },
  // ------------------------------------------------------ Packaged Foods
  C0401: {
    warranty: null,
    lines: [
      [B.NovaMart, 'Whole Wheat Atta {v}', 265, 'Stone-ground whole wheat flour for soft rotis.', 'atta,flour,staples', {}, [['5 kg', 0, { weight: '5 kg' }], ['10 kg', 234, { weight: '10 kg' }]]],
      [B.NovaMart, 'Unpolished Toor Dal {v}', 189, 'Unpolished arhar dal, rich in protein.', 'dal,pulses,staples', {}, [['1 kg', 0, { weight: '1 kg' }], ['2 kg', 176, { weight: '2 kg' }]]],
      [B.NovaMart, 'Sona Masoori Rice {v}', 399, 'Light, aromatic everyday rice.', 'rice,staples', {}, [['5 kg', 0, { weight: '5 kg' }], ['10 kg', 370, { weight: '10 kg' }]]],
      [B.NovaMart, 'Refined Sunflower Oil {v}', 149, 'Light cooking oil fortified with vitamins A and D.', 'cooking oil,sunflower oil,staples', {}, [['1 L', 0, { volume: '1 L' }], ['5 L', 550, { volume: '5 L' }]]],
      [B.NovaMart, 'Rolled Oats {v}', 199, 'High-fibre whole grain oats for breakfast.', 'oats,breakfast,healthy', {}, [['1 kg', 0, { weight: '1 kg' }], ['2 kg', 180, { weight: '2 kg' }]]],
      [B.Tata, 'Tata Sampann Moong Dal {v}', 95, 'Unpolished yellow moong dal.', 'dal,pulses,staples', {}, [['500 g', 0, { weight: '500 g' }], ['1 kg', 90, { weight: '1 kg' }]]],
      [B.Tata, 'Tata Sampann Kabuli Chana {v}', 99, 'Large, evenly sized chickpeas.', 'chana,chickpeas,pulses', {}, [['500 g', 0, { weight: '500 g' }], ['1 kg', 95, { weight: '1 kg' }]]],
      [B.Tata, 'Tata Sampann Turmeric Powder {v}', 68, 'Turmeric with natural oils intact.', 'turmeric,haldi,spices', {}, [['200 g', 0, { weight: '200 g' }], ['500 g', 92, { weight: '500 g' }]]],
      [B.Tata, 'Tata Sampann Besan {v}', 72, 'Fine gram flour made from unpolished chana dal.', 'besan,gram flour,staples', {}, [['500 g', 0, { weight: '500 g' }], ['1 kg', 68, { weight: '1 kg' }]]],
      [B.NovaMart, 'California Walnut Kernels {v}', 349, 'Light halves, rich in omega-3.', 'walnuts,dry fruits,nuts', {}, [['250 g', 0, { weight: '250 g' }], ['500 g', 330, { weight: '500 g' }]]],
      [B.NovaMart, 'Whole Cashews {v}', 299, 'Crunchy W320 grade cashews.', 'cashews,dry fruits,nuts', {}, [['250 g', 0, { weight: '250 g' }], ['500 g', 280, { weight: '500 g' }]]],
      [B.NovaMart, 'Crunchy Peanut Butter {v}', 189, 'Roasted peanuts with no added sugar.', 'peanut butter,spread,protein', {}, [['350 g', 0, { weight: '350 g' }], ['1 kg', 260, { weight: '1 kg' }]]],
      [B.NovaMart, 'Wild Forest Honey {v}', 199, 'Raw, unprocessed multi-flora honey.', 'honey,natural sweetener', {}, [['250 g', 0, { weight: '250 g' }], ['500 g', 170, { weight: '500 g' }]]],
    ],
  },
  // ----------------------------------------------------------- Beverages
  C0402: {
    warranty: null,
    lines: [
      [B.Nescafe, 'Nescafe Classic Instant Coffee {v}', 175, '100% pure instant coffee with a rich aroma.', 'coffee,instant coffee', {}, [['50 g', 0, { weight: '50 g' }], ['100 g', 155, { weight: '100 g' }], ['200 g', 445, { weight: '200 g' }]]],
      [B.Nescafe, 'Nescafe Gold Blend {v}', 375, 'Premium blend of arabica and robusta beans.', 'coffee,instant coffee,premium', {}, [['50 g', 0, { weight: '50 g' }], ['100 g', 350, { weight: '100 g' }]]],
      [B.Tata, 'Tata Tea Gold {v}', 160, 'Assam CTC blended with long leaves.', 'tea,black tea,chai', {}, [['250 g', 0, { weight: '250 g' }], ['500 g', 150, { weight: '500 g' }], ['1 kg', 440, { weight: '1 kg' }]]],
      [B.Tata, 'Tata Tea Premium {v}', 265, 'Strong everyday chai blend.', 'tea,black tea,chai', {}, [['500 g', 0, { weight: '500 g' }], ['1 kg', 245, { weight: '1 kg' }]]],
      [B.Tata, 'Tetley Green Tea Bags {v}', 165, 'Green tea with added vitamin C.', 'tea,green tea,healthy', {}, [['25 bags', 0, { count: 25 }], ['100 bags', 385, { count: 100 }]]],
      [B.NovaMart, 'Darjeeling Leaf Tea {v}', 349, 'Second flush whole leaf from the Darjeeling hills.', 'tea,darjeeling,premium', {}, [['250 g', 0, { weight: '250 g' }], ['500 g', 320, { weight: '500 g' }]]],
      [B.NovaMart, 'Cold Brew Coffee Bags {v}', 299, 'Steep overnight for a smooth, low-acid cold brew.', 'coffee,cold brew', {}, [['Pack of 5', 0, { count: 5 }], ['Pack of 10', 250, { count: 10 }]]],
      [B.NovaMart, 'South Indian Filter Coffee Powder {v}', 189, '80:20 coffee-chicory blend for authentic filter kaapi.', 'coffee,filter coffee', {}, [['200 g', 0, { weight: '200 g' }], ['500 g', 250, { weight: '500 g' }]]],
      [B.NovaMart, 'Tender Coconut Water {v}', 199, 'No added sugar or preservatives.', 'coconut water,juice,healthy', {}, [['200 ml x 6', 0, { volume: '1.2 L' }], ['1 L', -80, { volume: '1 L' }]]],
      [B.NovaMart, 'Alphonso Mango Juice {v}', 129, 'Made with Ratnagiri Alphonso pulp.', 'juice,mango', {}, [['1 L', 0, { volume: '1 L' }], ['2 L', 110, { volume: '2 L' }]]],
      [B.NovaMart, 'Sparkling Water {v}', 79, 'Unsweetened sparkling mineral water.', 'sparkling water,soda', {}, [['750 ml', 0, { volume: '750 ml' }], ['Pack of 6', 350, { volume: '4.5 L' }]]],
      [B.NovaMart, 'Masala Chai Premix {v}', 149, 'Just add hot water - ginger and cardamom chai.', 'tea,chai,instant', {}, [['250 g', 0, { weight: '250 g' }], ['1 kg', 400, { weight: '1 kg' }]]],
    ],
  },
};

/** Small deterministic PRNG (mulberry32) so the files are reproducible. */
function prng(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = prng(20261010);
const between = (min, max) => Math.floor(rand() * (max - min + 1)) + min;

const csvCell = (value) => {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};
const toCsv = (header, rows) =>
  [header.join(','), ...rows.map((r) => header.map((h) => csvCell(r[h])).join(','))].join('\n') + '\n';

const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Round a marked-up price to a retail-looking figure ending in 9/90/900. */
function retailRound(n) {
  if (n < 1000) return Math.round(n / 5) * 5;
  if (n < 20000) return Math.round(n / 100) * 100 - 1;
  return Math.round(n / 1000) * 1000 - 10;
}

function buildProducts() {
  const products = [];
  let seq = 0;

  for (const [categoryId, { warranty, lines }] of Object.entries(CATALOGUE)) {
    for (const [brandId, template, basePrice, description, keywords, baseSpecs, variants] of lines) {
      for (const [label, priceDelta, extraSpecs] of variants) {
        seq += 1;
        const id = `N${String(seq).padStart(4, '0')}`;
        const name = template.includes('{v}')
          ? template.replace('{v}', label)
          : label
            ? `${template} (${label})`
            : template;
        const price = basePrice + priceDelta;
        const mrp = Math.max(price, retailRound(price * (1 + between(5, 28) / 100)));
        const img = (n) => `https://picsum.photos/seed/${id.toLowerCase()}-${n}/800/800`;

        products.push({
          id,
          name,
          slug: `${slugify(name)}-${id.toLowerCase()}`,
          description,
          keywords,
          category_id: categoryId,
          brand_id: brandId,
          price,
          mrp,
          currency: 'INR',
          specifications: JSON.stringify({ ...baseSpecs, ...extraSpecs }),
          images: [img(1), img(2), img(3)].join('|'),
          rating: (between(36, 48) / 10).toFixed(1),
          rating_count: between(12, 4200),
          warranty_months: warranty ?? '',
          is_active: 'true',
        });
      }
    }
  }
  return products;
}

/**
 * Stock per store: ~8% out of stock and ~14% at or below the reorder level,
 * matching the hand-written inventory so the low-stock feed and the
 * "nearby store" fallback both have data. Warehouses hold deeper stock.
 */
function buildInventory(products, stores) {
  const rows = [];
  for (const product of products) {
    const [reorderLevel, min, max] =
      product.price >= 50000 ? [5, 6, 25] : product.price >= 2000 ? [10, 11, 80] : [25, 26, 300];

    for (const store of stores) {
      const roll = rand();
      let quantity;
      if (roll < 0.08) quantity = 0;
      else if (roll < 0.22) quantity = between(1, reorderLevel);
      else quantity = between(min, max) * (store.type === 'WAREHOUSE' ? 4 : 1);

      rows.push({
        store_id: store.id,
        product_id: product.id,
        quantity_available: quantity,
        quantity_reserved: quantity > 3 ? between(0, 3) : 0,
        reorder_level: reorderLevel,
      });
    }
  }
  return rows;
}

async function main() {
  const stores = parse(await readFile(path.join(seedDir, 'stores.csv'), 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const products = buildProducts();
  const inventory = buildInventory(products, stores);

  await writeFile(
    path.join(seedDir, 'products_generated.csv'),
    toCsv(Object.keys(products[0]), products)
  );
  await writeFile(
    path.join(seedDir, 'inventory_generated.csv'),
    toCsv(Object.keys(inventory[0]), inventory)
  );

  console.log(`[generate] products_generated.csv   ${products.length} products`);
  console.log(`[generate] inventory_generated.csv  ${inventory.length} rows across ${stores.length} stores`);
}

main().catch((err) => {
  console.error('[generate] error:', err.message);
  process.exit(1);
});
