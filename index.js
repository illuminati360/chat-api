// http
const HOST = process.env.HOST;
const PORT = process.env.PORT || 5000;

// mongo
const user = process.env.MONGO_USER;
const pass = process.env.MONGO_PASS;
const addr = process.env.MONGO_ADDR;
const port = process.env.MONGO_PORT;

const express = require('express');
const app = express(); 
const cors = require('cors');
const cookieParser = require('cookie-parser');
const corsOptions = {
    origin: `http://${HOST}`,
    credentials: true,
    optionsSuccessStatus: 200 
}
const authRoutes = require('./routes/authRoutes');
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser()); 
app.use(authRoutes);


const http = require('http').createServer(app);
const mongoose = require('mongoose');
const socketio = require('socket.io')
const io = socketio(http,{
    cors: {
        origin: `http://${HOST}`,
        credentials: true,
        transports: ['websocket', 'polling'],
        methods: ["GET", "POST"]
    }
}); 

const mongoDB = `mongodb://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${addr}:${port}/chat?authSource=admin&readPreference=primary&appname=MongoDB%20Compass&directConnection=true&ssl=false`;

mongoose.connect(mongoDB, { useNewUrlParser: true, useUnifiedTopology: true }).then(() => console.log('connected')).catch(err => console.log(err))

const { addUser, getUser, removeUser } = require('./util');
const Message = require('./models/Message');
const Room = require('./models/Room'); 

io.on('connection', (socket) => {
    console.log(socket.id);
    Room.find().then(result => {
        socket.emit('output-rooms', result)
        console.log('emit output-rooms')
    })
    socket.on('create-room', name => {
        const room = new Room({ name });
        room.save().then(result => {
            io.emit('room-created', result)
        })
    })
    socket.on('join', ({ name, room_id, user_id }) => {
        const { error, user } = addUser({
            socket_id: socket.id,
            name,
            room_id,
            user_id
        })
        socket.join(room_id);
        if (error) {
            console.log('join error', error)
        } else {
            console.log('join user', user)
        }
    })
    socket.on('sendMessage', (message, room_id, callback) => {
        const user = getUser(socket.id);
        if (!user){ return; }
        const msgToStore = {
            name: user.name,
            user_id: user.user_id,
            room_id,
            text: message
        }
        console.log('message', msgToStore)
        const msg = new Message(msgToStore);
        msg.save().then(result => {
            io.to(room_id).emit('message', result);
            callback()
        })

    })
    socket.on('get-messages-history', room_id => {
        Message.find({ room_id }).then(result => {
            socket.emit('output-messages', result)
        })
    })
    socket.on('disconnect', () => {
        const user = removeUser(socket.id);
    })
});

http.listen(PORT, () => {
    console.log(`listening on port ${PORT}`);
});
