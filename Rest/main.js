const WebSocket = require('ws');
const tmi = require('tmi.js');
const ks = require('node-key-sender');
const fs = require('fs').promises;
const version = "1.0";
const config = require('./config.json');
const http = require('http');
const path = require('path');

const client = new tmi.Client();
const wss = new WebSocket.Server({ port: 37219 });

let currentOptions = [];
let votes = [0, 0, 0, 0];
let lastOptions = [];
let usersVoted = [];
let lastwinner = null;
let chaosStarted = false;

let timer = 30;
let maxtime = 30;

const filePath = path.join(__dirname, 'index.html');
http.createServer(async (req, res) => {
    try {
        const data = await fs.readFile(filePath);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
    } catch (err) {
        res.writeHead(500);
        res.end('Internal Server Error');
    }
}).listen(8008);

async function readChannel() {
    try {
        const data = await fs.readFile('config.json', 'utf8');
        const jsonData = JSON.parse(data);

        if (jsonData.channel !== '-'){
            client.connect().then(() => {
                client.join(`${jsonData.channel}`);
            });
        }else{
            console.error([
                "                      ",
                "              You havent setup a channel name!               ",
                " Go over to the 'Cheat Engine' folder and run the config.bat file!                 ",
                "         After you've done that, re-run the start.bat file.               ",
                "        The mod will not work without a proper channel name.               ",
                "                      ",
            ].join("\n"))
        }


        return;
    } catch (err) {
        console.error('Error reading or parsing the JSON file:', err);
        return null;
    }
}
readChannel();


async function checkVer() {
    const url = "https://devpoland.xyz/api/elden-ring-chaos-mod-ver";
    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }
  
      const json = await response.json();
      const ver = json.version;
      
      if (ver != version){
        console.error([
            "                      ",
            "     You are running an outdated version of the mod!               ",
            " Head over to github.com/devPoland/EldenRingChaosMod/releases               ",
            "             For the latest mod release!               ",
            `      Your Version: ${version} vs Latest Version: ${ver}                `,
            "                      ",
        ].join("\n"))
      }

    } catch (error) {
      console.error("Something went wrong while trying to fetch latest version.");
    }
}
checkVer();

function getEnabledTriggers() {
    return Object.entries(config.triggers)
        .filter(([_, val]) => val.enabled)
        .map(([name, cfg]) => ({ name, chance: cfg.chance }));
}

function pickNewOptions() {
    const enabled = getEnabledTriggers();
    if (enabled.length === 0) {
        currentOptions = [];
        return;
    }

    let availableTriggers = enabled.filter(trigger => !lastOptions.includes(trigger.name));

    if (availableTriggers.length === 0) {
        availableTriggers = [...enabled];
    }

    const selected = [];
    const remainingTriggers = [...availableTriggers];

    while (selected.length < 4 && remainingTriggers.length > 0) {
        const totalWeight = remainingTriggers.reduce((sum, t) => sum + t.chance, 0);
        const random = Math.random() * totalWeight;
        let currentWeight = 0;

        for (const trigger of remainingTriggers) {
            currentWeight += trigger.chance;
            if (random <= currentWeight) {
                selected.push(trigger.name);
                const index = remainingTriggers.findIndex(t => t.name === trigger.name);
                remainingTriggers.splice(index, 1);
                break;
            }
        }
    }

    currentOptions = selected;
    lastOptions = [...currentOptions];
    votes = Array(currentOptions.length).fill(0);
    timer = maxtime;
}

function determineWinner() {
    const maxVotes = Math.max(...votes);
    const potentialWinners = currentOptions.filter((_, i) => votes[i] === maxVotes);
    return potentialWinners[Math.floor(Math.random() * potentialWinners.length)];
}

wss.on('connection', (ws) => {
    console.log('Client connected');
    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

function broadcastState() {
    const data = JSON.stringify({ timer, votes, options: currentOptions, lastwinner });
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}

let isKeyActive = false;
function toggleKeyForRound(keys) {
    ks.sendCombination(keys);
    setTimeout(() => ks.sendCombination(keys), 29000);
}

function processKeypresses(actionname) {
    if (actionname === "Ultra Speed"){
        ks.startBatch()
            .batchTypeCombination(['F21'], 3000)
            .batchTypeCombination(['F21'])
        .sendBatch();

    }else if(actionname === "Hypersonic Speed"){
        ks.startBatch()
            .batchTypeCombination(['F21', '1'], 3000)
            .batchTypeCombination(['F21', '1'])
        .sendBatch();

    }else if(actionname === "Slow Down"){
        ks.startBatch()
            .batchTypeCombination(['F21', '2'], 3000)
            .batchTypeCombination(['F21', '2'])
        .sendBatch();

    }else if(actionname === "Hitless Challenge"){
        const intvid = setInterval(() => {
            ks.sendCombination(['F24', '1']);
        }, 1000);

        setTimeout(() => {
            const checkTimer = setInterval(() => {
                if (timer <= 2) {
                    clearInterval(intvid);
                    clearInterval(checkTimer);

                    setTimeout(() => {
                        ks.sendCombination(['F24', '1']);
                    }, 500);
                }
            }, 1000);
        }, 5000);

    }else if(actionname === "No Stamina"){
        const intvid = setInterval(() => {
            ks.sendCombination(['F15']);
        }, 200);

        setTimeout(() => {
            const checkTimer = setInterval(() => {
                if (timer <= 2) {
                    clearInterval(intvid);
                    clearInterval(checkTimer);
                }
            }, 1000);
        }, 5000);

    }else if(actionname === "Heal HP"){
        ks.sendCombination(['F19', '9']);

    }else if(actionname === "Kill Player"){
        ks.sendCombination(['F24', '2']);

    }else if(actionname === "Laggy Player"){
       ks.sendCombination(['F17']);

    }else if(actionname === "Slow Motion"){
        ks.sendKey('F18');

        setTimeout(() => {
            const checkTimer = setInterval(() => {
                if (timer <= 2) {
                    clearInterval(checkTimer);

                    ks.sendKey('F18');
                }
            }, 1000);
        }, 5000);

    }else if(actionname === "Double Time"){
        ks.sendCombination(['F18', '1']);

        setTimeout(() => {
            const checkTimer = setInterval(() => {
                if (timer <= 2) {
                    clearInterval(checkTimer);
                    ks.sendCombination(['F18', '1']);
                }
            }, 1000);
        }, 5000);

    }else if(actionname === "Fake Crash"){
        ks.startBatch()
            .batchTypeCombination(['F18', '2'], Math.floor(Math.random() * 2000) + 2500)
            .batchTypeCombination(['F18', '2'], Math.floor(Math.random() * 2000) + 2250)
            
        .sendBatch();

    }else if(actionname === "Bad PC"){
        let state = false;

        const intvid = setInterval(() => {
            state = true;
            ks.sendCombination(['F18', '2']);
        
            const delay = Math.floor((Math.random() + 0.01) * 1000) + 100;
        
            setTimeout(() => {
                if (state) {
                    state = false;
                    ks.sendCombination(['numpad7']);
                }
            }, delay);
        
        }, Math.floor((Math.random() + 0.01) * 2000) + 1250);
        
        setTimeout(() => {
            const checkTimer = setInterval(() => {
                if (timer <= 2) {
                    clearInterval(intvid);
                    clearInterval(checkTimer);

                    setTimeout(() => {        
                        ks.sendCombination(['numpad7']);
                        state = false;
                    }, 500);
                }
            }, 1000);
        }, 5000);
        
    }else if(actionname === "Aussie Simulator"){
        ks.startBatch()
            .batchTypeCombination(['F20', '2'], 3000)
            .batchTypeCombination(['F20', '2'])
        .sendBatch()

    }else if(actionname === "Ultra Zoom"){
        ks.startBatch()
            .batchTypeCombination(['F20', '1'], 3000)
            .batchTypeCombination(['F20', '1'])
        .sendBatch();

    }else if(actionname === "Quake Pro FOV"){
        ks.startBatch()
            .batchTypeCombination(['F20'], 3000)
            .batchTypeCombination(['F20'])
        .sendBatch();

    }else if(actionname === "Giant Player"){
        ks.startBatch()
            .batchTypeCombination(['F22', '1'], 3000)
            .batchTypeCombination(['F22', '1'])
        .sendBatch();

    }else if(actionname === "Small Player"){
        ks.startBatch()
            .batchTypeCombination(['F22'], 3000)
            .batchTypeCombination(['F22'])
        .sendBatch();

    }else if(actionname === "Wide Player"){
        ks.startBatch()
            .batchTypeCombination(['F22', '3'], 3000)
            .batchTypeCombination(['F22', '3'])
        .sendBatch();

    }else if(actionname === "Glitchy Player"){
        ks.startBatch()
            .batchTypeCombination(['F22', '4'], 3000)
            .batchTypeCombination(['F22', '4'])
        .sendBatch();

    }else if(actionname === "Paper Mario"){
        ks.startBatch()
            .batchTypeCombination(['F22', '2'], 3000)
            .batchTypeCombination(['F22', '2'])
        .sendBatch();

    }else if(actionname === "Spawn 3 Dogs"){

        ks.startBatch()
            .batchTypeCombination(['F16', '8'], 450)  
        .sendBatch();
           
    }else if(actionname === "Spawn 3 Rats"){

        ks.startBatch()
            .batchTypeCombination(['F16', '7'], 450)  
        .sendBatch();
      
    }else if(actionname === "Spawn 3 Hawks"){

        ks.startBatch()
            .batchTypeCombination(['F16', '6'], 450)
        .sendBatch();
        
    }else if(actionname === "Spawn Promised Consort Radahn"){

        ks.startBatch()
            .batchTypeCombination(['F16', '5'], 450)
        .sendBatch();

    }else if(actionname === "Spawn Fake Promised Consort Radahn"){

        ks.startBatch()
            .batchTypeCombination(['F16', '4'], 450)  
        .sendBatch();
        
    }else if(actionname === "Randomise All Stats"){

        ks.startBatch()
            .batchTypeCombination(['numpad3'], 10000)
            .batchTypeCombination(['numpad3'], 10)
        .sendBatch();
        
    }else if(actionname === "-5 or +5 to Vigor"){

        ks.startBatch()
            .batchTypeCombination(['numpad3', '1'], 10000)
            .batchTypeCombination(['numpad3', '1'], 10)
        .sendBatch();
        
    }else if(actionname === "-5 or +5 to Mind"){

        ks.startBatch()
            .batchTypeCombination(['numpad3', '2'], 10000)
            .batchTypeCombination(['numpad3', '2'], 10)
        .sendBatch();
        
    }else if(actionname === "-5 or +5 to Endurance"){

        ks.startBatch()
            .batchTypeCombination(['numpad3', '3'], 10000)
            .batchTypeCombination(['numpad3', '3'], 10)
        .sendBatch();
        
    }else if(actionname === "-5 or +5 to Strength"){

        ks.startBatch()
            .batchTypeCombination(['numpad3', '4'], 10000)
            .batchTypeCombination(['numpad3', '4'], 10)
        .sendBatch();
        
    }else if(actionname === "-5 or +5 to Dexterity"){

        ks.startBatch()
            .batchTypeCombination(['numpad3', '5'], 10000)
            .batchTypeCombination(['numpad3', '5'], 10)
        .sendBatch();
        
    }else if(actionname === "-5 or +5 to Intelligence"){

        ks.startBatch()
            .batchTypeCombination(['numpad3', '6'], 10000)
            .batchTypeCombination(['numpad3', '6'], 10)
        .sendBatch();
        
    }else if(actionname === "-5 or +5 to Faith"){

        ks.startBatch()
            .batchTypeCombination(['numpad3', '7'], 10000)
            .batchTypeCombination(['numpad3', '7'], 10)
        .sendBatch();
        
    }else if(actionname === "-5 or +5 to Arcane"){

        ks.startBatch()
            .batchTypeCombination(['numpad3', '8'], 10000)
            .batchTypeCombination(['numpad3', '8'], 10)
        .sendBatch();
        
    }else if(actionname === "SPAWN MALENIA"){

        ks.startBatch()
            .batchTypeCombination(['f16', '3'])
        .sendBatch();
        
    }else if(actionname === "SPAWN INVISIBLE ASSASIN"){

        ks.startBatch()
            .batchTypeCombination(['f16', '2'])
        .sendBatch();
        
    }else if(actionname === "SPAWN A FRIENDLY DOG"){

        ks.startBatch()
            .batchTypeCombination(['f16', '1'])
        .sendBatch();
        
    }else if(actionname === "SPAWN A POT FRIEND"){

        ks.startBatch()
            .batchTypeCombination(['f16', '9'])
        .sendBatch();
        
    }else if(actionname === "SPAWN POTFRIEND GANG"){

        ks.startBatch()
            .batchTypeCombination(['f16', '0'])
        .sendBatch();
        
    }else if(actionname === "SPAWN A FRIENDLY TICHE"){

        ks.startBatch()
            .batchTypeCombination(['f17', '1'])
        .sendBatch();
        
    }else if(actionname === "SPAWN A GIANT RAT"){

        ks.startBatch()
            .batchTypeCombination(['f17', '2'])
        .sendBatch();
        
    }else if(actionname === "SPAWN A FRIENDLY GIANT RAT"){

        ks.startBatch()
            .batchTypeCombination(['f17', '3'])
        .sendBatch();
        
    }else if(actionname === "SPAWN A DRAGON"){

        ks.startBatch()
            .batchTypeCombination(['f17', '4'])
        .sendBatch();
        
    }else if(actionname === "SPAWN A FRIENDLY DRAGON"){

        ks.startBatch()
            .batchTypeCombination(['f17', '5'])
        .sendBatch();
        
    }else if(actionname === "GIVE RANDOM WEAPON"){
        ks.startBatch()
            .batchTypeCombination(['F13', '1'], 3000)
            .batchTypeCombination(['F13', '1'])
        .sendBatch()

    }else if(actionname === "GIVE RANDOM ARMOR"){
        ks.startBatch()
            .batchTypeCombination(['F13', '2'], 3000)
            .batchTypeCombination(['F13', '2'])
        .sendBatch()

    }else if(actionname === "GIVE RANDOM TALISMAN"){
        ks.startBatch()
            .batchTypeCombination(['F13', '3'], 3000)
            .batchTypeCombination(['F13', '3'])
        .sendBatch()

    }else if(actionname === "GIVE RANDOM ITEM"){
        ks.startBatch()
            .batchTypeCombination(['F13', '4'], 3000)
            .batchTypeCombination(['F13', '4'])
        .sendBatch()

    }else if(actionname === "Random Weapon"){
        ks.startBatch()
            .batchTypeCombination(['F23'], 3000)
            .batchTypeCombination(['F23'])
        .sendBatch()

    }else if(actionname === "Random Weapon Every Second"){
        ks.startBatch()
            .batchTypeCombination(['F23', '1'], 3000)
            .batchTypeCombination(['F23', '1'])
        .sendBatch()

    }else if(actionname === "Stop Moving"){
        ks.startBatch()
            .batchTypeCombination(['F21', '3'], 3000)
            .batchTypeCombination(['F21', '3'])
        .sendBatch()

    }else if(actionname === "TP all NPCs to Player"){
        ks.startBatch()
            .batchTypeCombination(['F14'], 3000)
            .batchTypeCombination(['F14'])
        .sendBatch()

    }else if(actionname === "TP Player to random NPC"){
        ks.startBatch()
            .batchTypeCombination(['F14', '1'], 3000)
            .batchTypeCombination(['F14', '1'])
        .sendBatch()

    }else if(actionname === "-5 or +5 to random stat"){
        ks.startBatch()
            .batchTypeCombination(['F14', '4'], 3000)
            .batchTypeCombination(['F14', '4'])
        .sendBatch()

    }else if(actionname === "Play Random Cutscene"){
        ks.startBatch()
            .batchTypeCombination(['F19',], 5000)
            .batchTypeCombination(['F19'])
        .sendBatch()

    }else if(actionname === "Teleport to random grace"){
        ks.startBatch()
            .batchTypeCombination(['F18', '3'], 5000)
            .batchTypeCombination(['F18', '3'])
        .sendBatch()

    }else if(actionname === "Sky Launch"){
        ks.sendCombination(['F24', '3']);

    }else if(actionname === "Horse Bomb"){
        ks.sendCombination(['F24', '4']);

    }else if(actionname === "Inverted Camera"){
        toggleKeyForRound(['F24', '5']);

    }else if(actionname === "Forbidden Healing"){
        toggleKeyForRound(['F24', '6']);

    }else if(actionname === "No FP"){
        ks.sendCombination(['F24', '7']);

    }else if(actionname === "Russian Roulette"){
        ks.sendCombination(['F24', '8']);

    }else if(actionname === "Deadly Bounce"){
        toggleKeyForRound(['F24', '9']);

    }

}


let retardproblemrequiresretardsolution = false;
let savetimer = 0;
function countdown() {
    if (timer > 0) {
        timer--;
        savetimer = timer;
        broadcastState();
    } else {
        if (!retardproblemrequiresretardsolution){
            retardproblemrequiresretardsolution = true;
            const winner = determineWinner();
            console.log(`Voting ended! Winner: ${winner}`);

            processKeypresses(winner);
            lastwinner = winner;

            setTimeout(() => {
                retardproblemrequiresretardsolution = false;
                pickNewOptions();
                usersVoted = [];
            }, 2000);
        }
    }
}


client.on('message', (channel, tags, message, self) => {
    if (message.startsWith("1") || message.startsWith("2") || message.startsWith("3") || message.startsWith("4")){
        const matchingItem = usersVoted.find(items => items.username === tags.username);
        if (matchingItem) return;
    }

    if (message.startsWith("1")){
        usersVoted.push({username: tags.username});
        votes[0]++;
    }else if(message.startsWith("2")){
        usersVoted.push({username: tags.username});
        votes[1]++;
    }else if(message.startsWith("3")){
        usersVoted.push({username: tags.username});
        votes[2]++;
    }else if(message.startsWith("4")){
        usersVoted.push({username: tags.username});
        votes[3]++;
    }
});


let countdownint;
let firsttimeopen = false;
client.on('message', (channel, tags, message, self) => {
    const [first, ...rest] = message.split(" ");
    const convfirst = first.toString().toLowerCase();

    if ((convfirst === '+start') && (tags.username === 'sonku___' || tags.username === 'devpoland' || tags.username === channel.substring(1))){
        if (chaosStarted) return console.log(`${tags.username} the chaos already started, why are we trying again?`)

        chaosStarted = true;
        if (!firsttimeopen){
            ks.sendCombination(['numpad1']);
            pickNewOptions();
            firsttimeopen = true;
        }
        console.log('THE CHAOS MOD HAS BEGUN!');
        console.log(`${tags.username} started the chaos. Vote with 1, 2, 3, 4!`)

        countdownint = setInterval(countdown, 1000)
        if (savetimer || savetimer != 0) {
            timer = savetimer;
        }

    }else if(convfirst === '+stop' && (tags.username === 'sonku___' || tags.username === 'devpoland' || tags.username === channel.substring(1))){
        if (chaosStarted){
            chaosStarted = false;
            console.log('THE CHAOS HAS BEEN STOPPED.');
            console.log(`${tags.username} stopped the chaos.`);
            clearInterval(countdownint);
        }else{
            console.log(`${tags.username} the chaos hasn't started yet, or has been paused, type +start to start it.`)
        }


    }
});

console.log([
    " _____  _   _   ___  _____ _____  ___  ______________ ",
    "/  __ \\| | | | / _ \\|  _  /  ___| |  \\/  |  _  |  _  \\",
    "| /  \\/| |_| |/ /_\\ \\ | | \\ `--.  | .  . | | | | | | |",
    "| |    |  _  ||  _  | | | |`--. \\ | |\\/| | | | | | | |",
    "| \\__/\\| | | || | | \\ \\_/ /\\__/ / | |  | \\ \\_/ / |/ / ",
    " \\____/\\_| |_/\\_| |_/\\___/\\____/  \\_|  |_/\\___/|___/  "
].join("\n"));

    
console.log([
    "                      ",
    "              Elden Ring Chaos Mod               ",
    "                  Developed By               ",
    "              Sonku and devPoland               ",
    "                      ",
    "                      ",
    "          Please Reload the OBS Overlay               ",
    "            And run +start in the chat               ",
    "                      ",
    "                      ",
    `              Running version v${version}               `,
    "             This  Version  Includes               ",
    "            Insane Cheat Engine Fixes               ",
    "               Improved Stability               ",
    "                 More triggers,               ",
    "              like,  a  lot  more               ",
    "          .bat files to automate setup               ",
    "               New config website               ",
    "       Ability to enable/disable triggers               ",
    "             And to change their odds               ",
    "             New method for triggers               ",
    "          We moved the project to GitHub,               ",
    "        Which sped up our overall workflow               ",
].join("\n"))
