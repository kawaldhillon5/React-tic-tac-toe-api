const WebSocket = require('ws');

exports.webSocketInitilize =  function() {
    const wss = new WebSocket.Server({ port: 8080});
    const clientsfindingMatch = [];
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
                if(msgObj){
                    if(!msgObj.type){
                        throw new Error('Invalid message type')
                    }
                }else {
                    throw new Error("Could not parse message");
                }
                if(msgObj.type === 'find-match'){
                    console.log("Clients in matchmaking queue:", clientsfindingMatch.map(client => client.id)); // Log client IDs
                    if(clientsfindingMatch.length){
                        const shiftedWs = clientsfindingMatch.shift()
                        clearTimeout(shiftedWs.matchMakingTimeout);
                        shiftedWs.matchMakingTimeout = null;
                        try {
                                ws.send(JSON.stringify({type: 'opponent', data: shiftedWs}));
                            } catch (error) {
                                console.error('Error sending message to current client:', error);
                            }
                        wss.clients.forEach((client) => {
                            if (client.readyState === WebSocket.OPEN) {
                                if(client.id === shiftedWs){
                                    try{
                                        client.send(JSON.stringify({type: "opponent", data: ws.id}));
                                        console.log(`match found for : ${shiftedWs}`," to:", ws.id);
                                    } catch(error){
                                        console.error('Error sending message to shifted client:', error);

                                    }
                                }
                            }
                        });
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
            } catch(error){
                console.error('Message Error:', error);
                try {
                    ws.send(JSON.stringify({type: 'error', message: error.message}));
                    ws.close();
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
