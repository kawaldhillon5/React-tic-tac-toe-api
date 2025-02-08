const asyncHandler = require("express-async-handler");
const passport = require("passport");
const LocalStrategy = require('passport-local');
const User = require("../models/user");
const genPassword = require("../scripts/passwordUtils").genPassword;
const validatePassword = require("../scripts/passwordUtils").validatePassword;


passport.use('local',
    new LocalStrategy(async (username, password, done) => {
      try {
        const user =  await User.findOne({userName: username}).collation({ locale: "en", strength: 2 }).exec();
        if (!user) {
          return done(null, false, { message: "Incorrect username" });
        };
        const isValid = validatePassword(password, user.hash ,user.salt);
        if (isValid) {
            return done(null, user);
        } else {
            return done(null, false, { message: "Incorrect password" });
        }
        
      } catch(err) {
        return done(err);
      };
    })
  );

  passport.serializeUser((user, done) => {
    done(null, user._id);
  });
  
  passport.deserializeUser(async (_id, done) => {
    try {
        const user = await User.findById(_id).collation({ locale: "en", strength: 2 }).exec();
        done(null, user);
    } catch(err) {
      done(err);
    };
  });

exports.signUp = asyncHandler( async(req, res, next)=>{

    const {salt, hash} = genPassword(req.body.data.password1);
    try {
      const userNameExists = await User.findOne({userName: req.body.data.username}).collation({ locale: "en", strength: 2 }).exec();
      if(userNameExists){
          throw new Error("Username Already Exists!");
      } else {
          const userNew = new User({
            userName: req.body.data.username,
            salt: salt,
            hash: hash,
            gamesPlayed: 0,
            gamesWon: 0,
            dateCreated: req.body.data.dateCreated,
          });
          const savedUser = await userNew.save();
          if(savedUser) {
            setTimeout(()=>{return res.status(200).end("Sign Up Sucessfull");},500)
          } else {
            throw new Error("Sign Up failed!")
          }
      }
    } catch(err){
      console.log(err);
      return res.status(404).send(err.message)
    }
});

 exports.LogIn = asyncHandler(async (req, res, next) => {  
        passport.authenticate("local", function (error, user, info) {
          if(error){
              return next(error);
          } if(!user) {
              return next(info.message);
          }
          req.logIn(user, function(err) {
              if (err) { return next(err); }
              return res.status(200).send({message: 'user Loged in' , userId: user._id}); 
            });
      })(req, res, next);
 });

 exports.User = asyncHandler( async (req, res, next) => {
  if(req.isAuthenticated()){
    res.send({userId: req.user._id, userName: req.user.userName, status: 200,});
  } else {
    res.status(200).send({userId:null});
  }
});

exports.LogOut = asyncHandler( async (req, res, next) => {
  req.logout(function(err) {
    if (err) {
      console.log(err); 
      return next(err); 
    }
    res.status(200).send({message:"User Loged out"});
  })
});