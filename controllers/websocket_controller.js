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
            const msgObj = JSON.parse(message.toString());
            if(msgObj.type === 'find-match'){
                console.log(clientsfindingMatch);
                if(clientsfindingMatch.length){
                    const shiftedWs = clientsfindingMatch.shift()
                    ws.send(JSON.stringify({type: 'opponent', data: shiftedWs}));
                    wss.clients.forEach((client) => {
                        if (client.readyState === WebSocket.OPEN) {
                            if(client.id === shiftedWs){
                                client.send(JSON.stringify({type: "opponent", data: ws.id}));
                                console.log(`match found for : ${shiftedWs}`," to:", ws.id);
                                } 
                            }
                        });
                } else{
                    console.log('no clients avaliable now');
                    clientsfindingMatch.push(ws.id);
                }
            }
        });

        // Event listener for client disconnection
        ws.on('close', () => {
            clientsfindingMatch.includes(ws.id) ? clientsfindingMatch.splice(clientsfindingMatch.indexOf(ws.id),1): null;
            console.log('A client disconnected.');
        });
    });

}
