const userModel = require('../models/user.model')
const jwt = require('jsonwebtoken')
const tokenBlacklistModel = require('../models/blacklist.model')

async function authMiddleware(req, res, next){
    const token = req.headers.authorization?.split(' ')[1] || req.cookies.token

    if(!token){
        return res.status(401).json({
            message: 'Unauthorized access. Token is missing',
        })
    }

    const isTokenBlacklisted = await tokenBlacklistModel.findOne({
        token: token
    })

    if(isTokenBlacklisted){
        return res.status(401).json({
            message: 'Unauthorized access. Token is blacklisted',
        })
    }

    try{
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        const user = await userModel.findById(decoded.userId)

        req.user = user
        
        return next()

    }catch (err) {
        return res.status(401).json({
            message: 'Unauthorized access. Token is invalid'
        })
    }
}

async function authsystemUserMiddleware(req, res, next){

const token = req.headers.authorization?.split(' ')[1] || req.cookies.token

    if(!token){
        return res.status(401).json({
            message: 'Unauthorized access. Token is missing',
        })
    }

    const isTokenBlacklisted = await tokenBlacklistModel.findOne({
        token: token
    })

    if(isTokenBlacklisted){
        return res.status(401).json({
            message: 'Unauthorized access. Token is blacklisted',
        })
    }

    try{
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        const user = await userModel.findById(decoded.userId).select('+systemUser')

        if(!user.systemUser){
            return res.status(403).json({
                message: 'Forbidden access. User is not a system user',
            })
        }

        req.user = user
       
        next()

    }catch (err) {
        return res.status(401).json({
            message: 'Unauthorized access. Token is invalid'
        })
    }
}

module.exports = {
    authMiddleware,
    authsystemUserMiddleware
}
