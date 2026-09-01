const zmq = require('zeromq');
const pako = require('pako');
const fs = require('fs-extra');
const path = require('path');
const plist = require('plist');

// --- CONFIGURATION PATHS ---
const GDRIVE_PATH = path.join(__dirname, 'GDrive');
const DBOX_PATH = path.join(__dirname, 'Dropbox');
const SOURCE_URL = 'tcp://eddn.edcd.io:9500';

const UPLOADER_PLIST_PATH = path.join(GDRIVE_PATH, 'Uploader.plist');
const MARKET_PLIST_PATH = path.join(GDRIVE_PATH, 'MarketData.plist');
const MODLIST_PLIST_PATH = path.join(GDRIVE_PATH, 'ModList.plist');
const SHIPLIST_PLIST_PATH = path.join(DBOX_PATH, 'ShipList.plist');

// --- DATA MAPPING DICTIONARIES ---
const SHIP_MAPPING = {
    'adder': 'Adder',
    'typex_3g': 'Alliance Challenger',
    'typex': 'Alliance Chieftain',
    'typex_2': 'Alliance Crusader',
    'anaconda': 'Anaconda',
    'asp': 'Asp Explorer',
    'asp_scout': 'Asp Scout',
    'belugaliner': 'Beluga Liner',
    'cobramkiii': 'Cobra Mk III',
    'cobramkiv': 'Cobra Mk VI',
    'diamondbackxl': 'Diamondback Explorer',
    'diamondback': 'Diamondback Scout',
    'dolphin': 'Dolphin',
    'eagle': 'Eagle',
    'federation_dropship_mkii': 'Federal Assault Ship',
    'federation_corvette': 'Federal Corvette',
    'federation_dropship': 'Federal Dropship',
    'federation_gunship': 'Federal Gunship',
    'ferdelance': 'Fer-de-Lance',
    'hauler': 'Hauler',
    'empire_trader': 'Imperial Clipper',
    'empire_courier': 'Imperial Courier',
    'cutter': 'Imperial Cutter',
    'empire_eagle': 'Imperial Eagle',
    'independant_trader': 'Keelback',
    'typex_3': 'Keelback',
    'krait_mkii': 'Krait Mk II',
    'krait_light': 'Krait Phantom',
    'mamba': 'Mamba',
    'orca': 'Orca',
    'python': 'Python',
    'sidewinder': 'Sidewinder',
    'type6': 'Type-6 Transporter',
    'type7': 'Type-7 Transporter',
    'type9': 'Type-9 Heavy',
    'type9_military': 'Type-10 Defender',
    'viper': 'Viper Mk III',
    'viper_mkiv': 'Viper Mk IV',
    'vulture': 'Vulture',
    'mandalay': 'Mandalay'
};

const ALL_SHIPS = [
    'Adder', 'Alliance Challenger', 'Alliance Chieftain', 'Alliance Crusader',
    'Anaconda', 'Asp Explorer', 'Asp Scout', 'Beluga Liner', 'Cobra Mk III',
    'Diamondback Explorer', 'Diamondback Scout', 'Dolphin', 'Eagle',
    'Federal Assault Ship', 'Federal Corvette', 'Federal Dropship', 'Federal Gunship',
    'Fer-de-Lance', 'Hauler', 'Imperial Clipper', 'Imperial Courier', 'Imperial Cutter',
    'Imperial Eagle', 'Keelback', 'Krait Mk II', 'Krait Phantom', 'Mamba',
    'Orca', 'Python', 'Sidewinder', 'Type-6 Transporter', 'Type-7 Transporter',
    'Type-9 Heavy', 'Type-10 Defender', 'Viper Mk III', 'Viper Mk IV', 'Vulture'
];

// In-memory global store
let uploadersDict = {};
let marketDataDicts = {};
let modList = {};
let shipList = {};

const stationTypDict = {};
let STATIONS_MAP = {};

// Dirty tracking flags to avoid unnecessary disk writes if data hasn't changed
const isDirty = {
    uploader: false,
    market: false,
    modList: false,
    shipList: false
};

// --- HELPER FUNCTIONS ---
async function readPlist(filePath) {
    try {
        if (await fs.pathExists(filePath)) {
            const content = await fs.readFile(filePath, 'utf8');
            return plist.parse(content) || {};
        }
    } catch (err) {
        console.error(`⚠️ Error reading plist at ${filePath}:`, err.message);
    }
    return {};
}

async function writePlist(filePath, data) {
    try {
        const xml = plist.build(data);
        await fs.outputFile(filePath, xml, 'utf8');
    } catch (err) {
        console.error(`⚠️ Error writing plist to ${filePath}:`, err.message);
    }
}

// Load existing files on boot
async function initializeState() {
    console.log("📂 Loading existing Plist files into memory...");
    uploadersDict = await readPlist(UPLOADER_PLIST_PATH);
    marketDataDicts = await readPlist(MARKET_PLIST_PATH);
    modList = await readPlist(MODLIST_PLIST_PATH);
    shipList = await readPlist(SHIPLIST_PLIST_PATH);
    console.log("✅ State initialization complete.");
}

// Scheduled 60-second disk sync function
async function syncToDisk() {
    try {
        if (isDirty.uploader) {
            await writePlist(UPLOADER_PLIST_PATH, uploadersDict);
            isDirty.uploader = false;
        }
        if (isDirty.market) {
            await writePlist(MARKET_PLIST_PATH, marketDataDicts);
            isDirty.market = false;
        }
        if (isDirty.modList) {
            await writePlist(MODLIST_PLIST_PATH, modList);
            isDirty.modList = false;
        }
        if (isDirty.shipList) {
            await writePlist(SHIPLIST_PLIST_PATH, shipList);
            isDirty.shipList = false;
        }
        process.stderr.write(`💾 [DISK SYNC] Saved updated Plists to disk (60s timer).\n`);
    } catch (err) {
        console.error(`❌ Sync to disk failed: ${err.message}`);
    }
}

// --- CORE PAYLOAD PROCESSOR ---
function processPayload(payloadObj) {
    const header = payloadObj.header || {};
    const message = payloadObj.message || {};

    const system = message.systemName;
    const station = message.stationName;
    const gVersion = header.gameversion || message.gameversion;
    const timestamp = message.timestamp;
    const uploaderID = header.uploaderID;

    // 1. Update Uploader Dict in Memory
    if (uploaderID) {
        uploadersDict[uploaderID] = (uploadersDict[uploaderID] || 0) + 1;
        isDirty.uploader = true;
    }

    // Resolve station type
    let stationType = 'Outpost';
    const mark = `${station}_${system}`;
    if (STATIONS_MAP && STATIONS_MAP[mark] && STATIONS_MAP[mark].stationType) {
        stationType = STATIONS_MAP[mark].stationType;
    }

    // 2. Process Shipyard & Outfitting Packets
    if (gVersion === 'CAPI-Legacy-shipyard') {
        const ships = message.ships || [];
        if (ships.length > 0) {
            stationTypDict[station] = 'Coriolis';
        }

        const modules = message.modules || [];
        if (modules.length > 0) {
            // Update ModList in Memory
            for (const moduleL of modules) {
                const module = moduleL.toLowerCase();
                const existingSystems = modList[module] || {};
                const existingStations = existingSystems[system] || {};

                modList[module] = {
                    ...existingSystems,
                    [system]: {
                        ...existingStations,
                        [station]: timestamp
                    }
                };
            }
            isDirty.modList = true;
        } else if (ships.length > 0) {
            // Update ShipList in Memory
            for (const removeShip of ALL_SHIPS) {
                if (shipList[removeShip] && shipList[removeShip][system]) {
                    delete shipList[removeShip][system][station];
                    if (Object.keys(shipList[removeShip][system]).length === 0) {
                        delete shipList[removeShip][system];
                    }
                }
            }

            for (const shipKey of ships) {
                const shipType = SHIP_MAPPING[shipKey];
                if (!shipType) {
                    console.warn(`⚠️ Unmapped ship type received: ${shipKey}`);
                    continue;
                }

                const existingSystems = shipList[shipType] || {};
                const existingStations = existingSystems[system] || {};

                shipList[shipType] = {
                    ...existingSystems,
                    [system]: {
                        ...existingStations,
                        [station]: timestamp
                    }
                };
            }
            isDirty.shipList = true;
        }
    }

    // 3. Process Market Packets
    if (gVersion === 'CAPI-Legacy-market') {
        if (stationType === 'Outpost' && stationTypDict[station]) {
            stationType = stationTypDict[station];
        }

        const commodities = message.commodities || [];
        const sysDicts = {
            timestamp: timestamp,
            StationName: station,
            Items: commodities,
            StationType: stationType,
            StarSystem: system
        };

        const existingSystem = marketDataDicts[system] || {};
        existingSystem[station] = sysDicts;
        marketDataDicts[system] = existingSystem;
        isDirty.market = true;
    }
}

// --- MAIN RUNNER ---
async function main() {
    await initializeState();

    // Trigger disk writes every 60,000 ms (1 minute)
    setInterval(syncToDisk, 60000);

    // Synchronize disk on app termination
    process.on('SIGINT', async () => {
        console.log('\n🛑 Shutdown signal received. Performing final disk write...');
        await syncToDisk();
        process.exit(0);
    });

    console.log("🚀 Initializing EDDN Stream Listener...");
    const sock = zmq.socket('sub');

    sock.on('error', (err) => {
        process.stderr.write(`🔌 ZeroMQ Socket Error: ${err.message}\n`);
        process.exit(1);
    });

    console.log(`🔗 Connecting to endpoint: ${SOURCE_URL}`);
    sock.connect(SOURCE_URL);
    sock.subscribe('');

    let packetCount = 0;

    sock.on('message', function(src) {
        try {
            packetCount++;
            const decompressed = pako.inflate(src);
            const outputLine = Buffer.from(decompressed).toString('utf-8');
            const payloadObj = JSON.parse(outputLine);

            let gameversion = "Unknown Version";
            if (payloadObj.header && payloadObj.header.gameversion) {
                gameversion = payloadObj.header.gameversion;
            } else if (payloadObj.message && payloadObj.message.gameversion) {
                gameversion = payloadObj.message.gameversion;
            }

            if (gameversion.includes('Legacy') || gameversion === '3.8.0.1400') {
                process.stderr.write(`⚙️  [IN-MEMORY UPDATE] Legacy Packet #${packetCount} [${gameversion}]\n`);
                processPayload(payloadObj);
            } else {
                process.stderr.write(`🗑️  [DROPPED] Non-legacy packet #${packetCount} skipped: [${gameversion}]\n`);
            }
        } catch (err) {
            process.stderr.write(`❌ Processing Error: ${err.message}\n`);
        }
    });
}

process.on('uncaughtException', async (err) => {
    process.stderr.write(`💥 Fatal Exception: ${err.message}\n`);
    await syncToDisk();
    process.exit(1);
});

process.on('unhandledRejection', async (reason) => {
    process.stderr.write(`💥 Unhandled Rejection: ${reason}\n`);
    await syncToDisk();
    process.exit(1);
});

main();
