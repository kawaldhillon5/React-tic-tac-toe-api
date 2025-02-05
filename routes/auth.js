const express = require('express');
const router = express.Router();
const authController = require("../controllers/authController");

router.post('/logIn', authController.LogIn);
router.post('/signUp', authController.signUp);
router.get('/user', authController.User);
router.post('/logOut', authController.LogOut);

module.exports = router;