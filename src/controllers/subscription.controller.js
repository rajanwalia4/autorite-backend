const httpStatus = require("http-status");
const catchAsync = require("../utils/CatchAsync");
const {subscriptionService} =require("../services");
const ApiError = require("../utils/ApiError");
const config = require("../config");
const fs = require("fs");
const { isGeneratorFunction } = require("util/types");


const webhook = catchAsync(async (req, res) => {
    await subscriptionService.handleWebhook(req,res);
    return res.status(httpStatus.OK).send({message :"success"});
});

const getAllPlans = catchAsync(async (req, res) => {
    const plans = await subscriptionService.getAllPlans();
    return res.status(httpStatus.OK).send(plans);
});

const createSubscription = catchAsync(async (req, res) => {
    const request = {...req.body};
    if(request.plan_id == 1)
        throw new ApiError(httpStatus.BAD_REQUEST, "This is a trial plan!");
    const planInfo = await subscriptionService.getPlanById(request.plan_id);
    const subscriptionInfo = await subscriptionService.createSubscription(request,planInfo);
    return res.status(httpStatus.OK).send({subscriptionInfo,message:"Subscription Session Created"});
});

module.exports = {
    webhook,
    getAllPlans,
    createSubscription
}