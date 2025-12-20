import Joi from "joi";

export const sendMessageValidation = (data) => {
  const schema = Joi.object({
    matchId: Joi.string().required(),
    content: Joi.string().max(1000).required()
  });

  return schema.validate(data);
};
