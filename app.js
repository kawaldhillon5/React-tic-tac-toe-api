require("dotenv").config();
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const MongoStore = require('connect-mongo');
const cors = require("cors");
const authRouter = require('./routes/auth');

const { webSocketInitilize } = require('./controllers/websocket_controller');


const databaseUrl = process.env.DATABASE_URL;
const frontEndUrl = process.env.FRONTEND_URL; 
const wsUrl = process.env.WS_URL;

var indexRouter = require('./routes/index');
var app = express();

app.use(cors({credentials: true, origin:[frontEndUrl, wsUrl]}));

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

mongoose.set("strictQuery", false);
const mongoDB = databaseUrl

main().catch((err) => console.log(err));
async function main() {
  await mongoose.connect(mongoDB);
}

app.use(session({
  secret: "cats",
  resave: false, 
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl:mongoDB,
  }),
  cookie: { maxAge: 1000 * 60 * 60 * 24,
            secure: false,
  },
}));

app.use(passport.initialize());
app.use(passport.session());


app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

webSocketInitilize()


app.use('/', indexRouter);
app.use('/authenticate', authRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.send(err);
});

module.exports = app;
