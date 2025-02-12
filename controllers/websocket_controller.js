const WebSocket = require('ws');
const User = require('../models/user');
const { matchMaking } = require('../scripts/matchMaking');
const { onTossRequest, checkWinner, quitMatch, beginMatch, setInitialBoxValues } = require('../scripts/gameLogic');



exports.webSocketInitilize =  function() {
    const wss = new WebSocket.Server({ port: 5174});
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
                        onTossRequest(ws, matchesBeingPlayed);
                        break;
                    case 'begin-match':
                        const matchId = beginMatch(ws);
                        if(matchId){
                            const match = matchesBeingPlayed.get(ws.matchId);
                            if(match){
                                setInitialBoxValues(match, ws)
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
                        quitMatch(ws, matchesBeingPlayed);   
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



