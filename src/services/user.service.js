const ApiError = require("../utils/ApiError");
const httpStatus = require("http-status");
const bcrypt = require("bcrypt");
const { User } = require("../db");

const createUser = async (userBody) => {
    let [user] = await User.getUserByEmail(userBody.email);
    if (user) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Email already taken");
    }
    userBody.password = await bcrypt.hash(userBody.password, 10);
    user = await User.create(userBody);
    userBody.id = user.insertId;
    delete userBody.password;
    return userBody;
}

module.exports = {
    createUser
}
