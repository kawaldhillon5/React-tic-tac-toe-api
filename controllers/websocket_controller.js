const WebSocket = require('ws');
const User = require('../models/user');
const { v4: uuidv4 } = require('uuid')


exports.webSocketInitilize =  function() {
    const wss = new WebSocket.Server({ port: 8080});
    const clientsfindingMatch = [];
    const matchesBeingPlayed = new Map();
// WebSocket event handling
    wss.on('connection', (ws,req) => {
        console.log('A new client connected.');
        const userID = (req.url.substring(1)) ;
        ws.id = userID;
        console.log("ws.id: ",ws.id);
        // Event listener for incoming messages
        ws.on('message', async(message) => {
            try{
                const msgObj = JSON.parse(message.toString());
                console.log(msgObj);
                if(!msgObj){
                    throw new Error("Could not parse message");
                }

                switch (msgObj.type) {
                    case 'find-match':
                        matchMaking(clientsfindingMatch, ws)
                        break;
                    case 'toss-request':
                        if(ws.opponent){
                            const tossWinner = toss(ws);
                            if(tossWinner){
                                const valuesArr = ['','','','','','','','','']
                                matchesBeingPlayed.set(ws.matchId, {player1: tossWinner, player2: tossWinner.opponent, round: 0, playerTurn: tossWinner, boxValue: valuesArr});
                            }
                        }
                        break;
                    case 'begin-match':
                        const matchId = beginMatch(ws);
                        if(matchId){
                            const match = matchesBeingPlayed.get(ws.matchId);
                            if(match){
                                if(match.moveTimerId){
                                    clearTimeout(match.moveTimerId);
                                }
                                match.moveTimerId = setTimeout(()=>{
                                   matchWon(match.playerTurn.opponent, "Time Out", [], match, false)
                                },5000)
                                match.boxValue.forEach((element, i) => {
                                    match.boxValue[i] = '';
                                });
                                ws.send(JSON.stringify({type: 'match-initial-info', data:{matchId: ws.matchId, round: match.round, playerTurn: match.playerTurn.userName}}));
                                ws.opponent.send(JSON.stringify({type: 'match-initial-info', data:{matchId: ws.matchId, round: match.round, playerTurn: match.playerTurn.userName}}));
                            }else{
                                throw new Error('Could not find match in array');
                            }
                        }
                        break;
                    case 'move':
                        const match = matchesBeingPlayed.get(ws.matchId);
                        if(match){
                            checkWinner(ws, match, msgObj);
                        }else{
                            throw new Error('Could not find match in array');
                        }
                        break;
                    case "quit-match":
                        {
                            ws.opponent.send(JSON.stringify({type: 'error', message: `${ws.userName.userName} Quit`}));
                            ws.opponent.isReady = false;
                            ws.opponent.moves = [];
                            ws.opponent.score = 0;
                            ws.opponent.isTossReady = false;
                            ws.opponent.matchId = '';
                            matchesBeingPlayed.delete(ws.matchId);
                            ws.close()
                        }    
                        break;
                    default:                        
                        throw new Error('Invalid message type')
                }
            } catch(error){
                console.error('Message Error:', error);
                try {
                    ws.send(JSON.stringify({type: 'error', message: error.message}));
                } catch (sendError) {
                    console.error('Error sending error message to client:', sendError);
                }
            }
        });

        // Event listener for client disconnection
        ws.on('close', () => {
            console.log(`Client disconnected: ${ws.id}`);
            const index = clientsfindingMatch.indexOf(ws);
            if (index !== -1) {
                clientsfindingMatch.splice(index, 1); // Remove from queue if in it
                if (ws.matchTimeout) {
                    clearTimeout(ws.matchTimeout); // Clear timeout if it was set
                    ws.matchTimeout = null;
                }
                console.log(`Client ${ws.id} removed from matchmaking queue.`);
            }
        });

        ws.on('error', (error) => {
            console.error('WebSocket error for client:', ws.id, error);
            const index = clientsfindingMatch.indexOf(ws);
            if (index !== -1) {
                clientsfindingMatch.splice(index, 1);
                if (ws.matchTimeout) {
                    clearTimeout(ws.matchTimeout);
                    ws.matchTimeout = null;
                }
                console.log(`Client ${ws.id} removed from matchmaking queue.`);
            }
        });
    });

    wss.on('error', (error) => {
        console.error('WebSocket server error:', error);
    });

}

const matchMaking = async function(clientsfindingMatch, ws){
    console.log("Clients in matchmaking queue:", clientsfindingMatch.map(client => client.id)); // Log client IDs
    if(clientsfindingMatch.length){
        const shiftedWs = clientsfindingMatch.shift()
        clearTimeout(shiftedWs.matchMakingTimeout);
        shiftedWs.matchMakingTimeout = null;
        try {
                const shiftedWsUsername = await User.findById(shiftedWs.id ,'userName').exec();
                const userName = await User.findById(ws.id,'userName').exec();
                if(!shiftedWsUsername && !userName){
                    throw new Error('Error setting opponent');
                }
                ws.opponent = shiftedWs;
                ws.moves = [];
                ws.userName = userName;
                shiftedWs.userName = shiftedWsUsername;
                shiftedWs.moves = [];
                shiftedWs.opponent = ws;
                ws.send(JSON.stringify({type: 'opponent', data: shiftedWsUsername}));
                shiftedWs.send(JSON.stringify({type: "opponent", data: userName}));
                console.log(`match found for : ${shiftedWs.id}`," to:", ws.id);
            } catch (error) {
                console.error('Error sending message to client:', error);
            }
    } else{
        console.log('no clients avaliable now, adding client to waiting array: ',ws.id);
        clientsfindingMatch.push(ws);

        //timeout function inCase no macth is found
        ws.matchMakingTimeout = setTimeout(()=>{
            console.log("matchmaking Timeout for client: ",ws.id);
            const index = clientsfindingMatch.indexOf(ws);
            if (index !== -1) {
                clientsfindingMatch.splice(index, 1);
                try{
                    ws.send(JSON.stringify({ type: 'timeout', message: 'Matchmaking timed out' })); // Inform the client
                } catch (sendError) {
                    console.error('Error sending timeout message to client:', sendError);
                } finally {
                    ws.close(); // Close the connection from the server
                    console.log(`Disconnected client ${ws.id} due to matchmaking timeout.`);
                }
            } else {
                console.log(`Client ${ws.id} was already removed from queue (likely matched). Timeout cleanup done.`);
            }
        },5000)
    }
}

const toss = function(ws){
    let randomWinner;
    if(ws.opponent.isTossReady){
        ws.idTossReady = true;
        randomWinner = Math.random() < 0.5 ? ws : ws.opponent;
        const matchId = uuidv4();
        ws.matchId = matchId
        ws.opponent.matchId = matchId;
        ws.score = 0
        ws.opponent.score = 0
        if(ws.id === randomWinner.id) {
            ws.mark = "X";
            ws.opponent.mark = "O";
        }else {
            ws.mark = "O";
            ws.opponent.mark = "X";
        }
        try {
            ws.send(JSON.stringify({type: "toss-results", data: {userMark : ws.mark, opponentMark: ws.opponent.mark}}));
            ws.opponent.send(JSON.stringify({type: "toss-results", data: {userMark: ws.opponent.mark, opponentMark: ws.mark}}));
        }catch(error){
            console.log("Error sending toss results to clinets: ",error);
            ws.close();
            ws.opponent.close();
            return false;
        }
        return randomWinner;
    }else{
        ws.isTossReady = true;
        return false;
    }
}

const beginMatch = function(ws){
    if(ws.opponent.isReady){
        ws.isReady = true;
        return ws.matchId
    } else {
        ws.isReady = true;
        return false;
    }
}

function matchWon(ws, info, winnigCondition, match,cond, position){
    ws.score = ws.score + 1;
    ws.isReady = false;
    ws.opponent.isReady = false
    if(cond){
        ws.opponent.send(JSON.stringify({type: 'move', data:{matchId: ws.matchId, round: match.round, mark:ws.mark, position: position, playerTurn: match.playerTurn.userName}}));
        ws.send(JSON.stringify({type: 'move', data:{matchId: ws.matchId, round: match.round, mark:ws.mark, position: position, playerTurn: match.playerTurn.userName}}));
    } else {
        match.playerTurn = ws
    }
    ws.send(JSON.stringify({type: 'match-won', data:{positionArray : winnigCondition , winner: true, winnerScore: ws.score, opponentScore: ws.opponent.score, info:info}}));
    ws.opponent.send(JSON.stringify({type: 'match-won', data:{positionArray : winnigCondition, winner: false, winnerScore: ws.score, opponentScore: ws.opponent.score, info:info}}));
}

function checkWinner(ws, match, msgObj, moveTimerId){
    if(match.moveTimerId){
        clearTimeout(match.moveTimerId);
    }

    if(match.playerTurn = ws){
        const position = msgObj.data.position
        match.boxValue[Number(position.slice(3))] = msgObj.data.mark
        ws.moves.push({mark: msgObj.data.mark,position: position});

        let winnigCondition = [];

        const winConditions = [
            [0, 1, 2],
            [3, 4, 5],
            [6, 7, 8],
            [0, 3, 6],
            [1, 4, 7],
            [2, 5, 8],
            [0, 4, 8],
            [2, 4, 6]
        ];
        let roundWon = false;

        for(let i = 0; i < winConditions.length; i++){

            const condition = winConditions[i];
            const cellA = match.boxValue[condition[0]]
            const cellB = match.boxValue[condition[1]]
            const cellC = match.boxValue[condition[2]]

            if(cellA == "" || cellB == "" || cellC == ""){
                continue;
            }
            if(cellA == cellB && cellB == cellC){
                roundWon = true;
                winnigCondition = condition
                break;
            }
        }

        if(roundWon){
            matchWon(ws, '', [`box${winnigCondition[0]}`,`box${winnigCondition[1]}`,`box${winnigCondition[2]}`], match, true, position, moveTimerId)
        } else if(!match.boxValue.includes('')){
            match.playerTurn = ws.opponent;
            ws.isReady = false;
            ws.opponent.isReady = false
            const player1Score = ws === match.player1 ? match.player1.score : match.player2.score;
            const player2Score = ws === match.player1 ? match.player2.score : match.player1.score;

            ws.send(JSON.stringify({type: 'move', data:{matchId: ws.matchId, round: match.round, mark:ws.mark, position: position, playerTurn: match.playerTurn.userName}}));
            ws.send(JSON.stringify({type: 'match-draw', data:{userScore: player1Score, opponentScore: player2Score}}));
            ws.opponent.send(JSON.stringify({type: 'move', data:{matchId: ws.matchId, round: match.round, mark:ws.mark, position: position, playerTurn: match.playerTurn.userName}}));
            ws.opponent.send(JSON.stringify({type: 'match-draw', data:{userScore: player2Score, opponentScore: player1Score}}));
        } else {
            match.playerTurn =  ws.opponent
            ws.send(JSON.stringify({type: 'move', data:{matchId: ws.matchId, round: match.round, mark:ws.mark, position: position, playerTurn: match.playerTurn.userName}}));
            ws.opponent.send(JSON.stringify({type: 'move', data:{matchId: ws.matchId, round: match.round, mark:ws.mark, position: position, playerTurn: match.playerTurn.userName}}));

            match.moveTimerId = setTimeout(()=>{
                matchWon(match.playerTurn.opponent, "Time Out", [], match, false)
            },5000)
        }
    } else {
        throw new Error("wrong player move");
    }
}