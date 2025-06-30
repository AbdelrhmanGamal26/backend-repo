const Handlebars = require('handlebars');

const handlebarsEmailTemplateCompiler = (
  emailTemplate: string,
  templateData: { [key: string]: string },
) => {
  const template = Handlebars.compile(emailTemplate);
  const message = template(templateData);
  return message;
};

export default handlebarsEmailTemplateCompiler;
