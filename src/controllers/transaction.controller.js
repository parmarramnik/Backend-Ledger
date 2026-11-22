const transactionmodel = require('../models/transaction.model')
const ledgerModel = require('../models/ledger.model')
const accountModel = require('../models/account.model')
const emailService = require('../services/email.service')
const mongoose = require('mongoose')


async function createTransaction(req, res){


    /**
     * 1. Validate Request 
     */
    const { fromAccount, toAccount, amount, idempotencyKey } = req.body

    if(!fromAccount || !toAccount || !amount || !idempotencyKey){
        return res.status(400).json({
            message: 'fromAccount, toAccount, amount, and idempotencyKey are required fields'
        })
    }

    const fromUserAccount = await accountModel.findOne({
        _id: fromAccount
    })

    const toUserAccount = await accountModel.findOne({
        _id: toAccount
    })

    if(!fromUserAccount || !toUserAccount){
        return res.status(404).json({
            message: 'Invalid fromAccount or toAccount'
        })
    }


    /**
     * 2. Validate Idempotency Key
     */
    
    const isTransactionAlreadyExists = await transactionmodel.findOne({
        idempotencyKey: idempotencyKey
    })

    if(isTransactionAlreadyExists){
        if(isTransactionAlreadyExists.status === 'COMPLETED'){
            return res.status(200).json({
                message: 'Transaction already completed',
                transaction: isTransactionAlreadyExists
            })
        }

        if(isTransactionAlreadyExists.status === 'PENDING'){
            return res.status(200).json({
                message: 'Transaction is still processing.',
            })
        }

        if(isTransactionAlreadyExists.status === 'FAILED'){
            return res.status(500).json({
                message: 'Transaction failed. Please try again.',
            })
        }

        if(isTransactionAlreadyExists.status === 'REVERSED'){
            return res.status(500).json({
                message: 'Transaction has been reversed. Please try again.',
            })
        }
    }


    /**
    * 3. check account status
    */

    if(fromUserAccount.status !== 'ACTIVE' || toUserAccount.status !== 'ACTIVE'){
        return res.status(400).json({
            message: 'Both fromAccount and toAccount must be ACTIVE to perform a transaction'
        })
    }


    /**
     * 4. Derive sender balace from ledger
     */
    
    const balance = await fromUserAccount.getBalance()

    if(balance < amount){
        return res.status(400).json({
            message: `Insufficient balance. Current balance is ${balance}. Requested amount is ${amount}.`,
        })
    }

    try {

    /**
     * 5. Create the transaction (PENDING)
     */

    const session = await mongoose.startSession()
    session.startTransaction()
    
    const transaction = (await transactionmodel.create([{
        fromAccount,
        toAccount,
        amount,
        idempotencyKey,
        status: 'PENDING'
    }], { session }))[0]

    /**
     * 6. Create DEBIT ledger entry
     */

    const debitLedgerEntry = await ledgerModel.create([{
        account: fromAccount,
        amount: amount,
        transaction: transaction._id,
        type: 'DEBIT',
    }], { session })

    await (() => {
        return new Promise((resolve) => {setTimeout(resolve, 15*1000)})
    })()

    /**
     * 7. Create CREDIT ledger entry
     */

    const creditLedgerEntry = await ledgerModel.create([{
        account: toAccount,
        amount: amount,
        transaction: transaction._id,
        type: 'CREDIT',
    }], { session })

    /**
     * 8. Mark transaction COMPLETED
     */

    await transactionmodel.findOneAndUpdate(
        { _id: transaction._id },
        { status: 'COMPLETED' }, 
        { session }
    )

    /**
     * 9. Commit MongoDB session
     */

    await session.commitTransaction()
    session.endSession()

    } catch (error) {
        return res.status(400).json({
            message: 'Transaction is pending due to some issue. Please try again after some time.',
        })
    }

    


    /**
    * 10. send email notification
    */

    await emailService.sendTransactionEmail({email: req.user.email, name: req.user.name}, amount, toUserAccount._id)

    return res.status(201).json({
        message: 'Transaction completed successfully',
        transaction: transaction
    })

}

async function createInitialFundsTransaction(req, res){
    const { toAccount, amount, idempotencyKey } = req.body

    if(!toAccount || !amount || !idempotencyKey){
        return res.status(400).json({
            message: 'toAccount, amount, and idempotencyKey are required'
        })
    }

    const toUserAccount = await accountModel.findOne({
        _id: toAccount
    })

    if(!toUserAccount){
        return res.status(404).json({
            message: 'Invalid toAccount'
        })
    }

    const fromUserAccount = await accountModel.findOne({
        user: req.user._id
    })

    if(!fromUserAccount){
        return res.status(404).json({
            message: 'System user account not found for the user'
        })
    }

    const session = await mongoose.startSession()
    session.startTransaction()

    const transaction = new transactionmodel({
        fromAccount: fromUserAccount._id,
        toAccount,
        amount,
        idempotencyKey,
        status: 'PENDING'
    })

    const debitLedgerEntry = await ledgerModel.create([{
        account: fromUserAccount._id,
        amount: amount,
        transaction: transaction._id,
        type: 'DEBIT'
    }], { session })

    const creditLedgerEntry = await ledgerModel.create([{
        account: toAccount,
        amount: amount,
        transaction: transaction._id,
        type: 'CREDIT'
    }], { session })

    transaction.status = 'COMPLETED'
    await transaction.save({ session })

    await session.commitTransaction()
    session.endSession()

    return res.status(201).json({
        message: 'Initial funds transaction completed successfully',
        transaction: transaction
    })

}

module.exports = {
    createTransaction,
    createInitialFundsTransaction
}
