const apiCalls = require("../helpers/apiCalls");
const {generateService} = require("../services");
const {Article} = require("../db");
const {ARTICLE} = require("../utils/constants");
const ApiError = require("../utils/ApiError");
const httpStatus = require("http-status");

function getRelatedQuestions(keyword,location){
    return new Promise(async (resolve,reject)=>{
        try{
            const response = await apiCalls.hitValueSerp(keyword,location);
            let relatedQuestions = [];
            let MAXIMUM_RELATED_QUESTIONS = 4;
            if(response.data.related_questions){
                for(let el of response.data.related_questions){
                    if(el.question){
                        relatedQuestions.push(el.question.trim());
                    }
                    if(relatedQuestions.length === MAXIMUM_RELATED_QUESTIONS){
                        break;
                    }
                }
            }
            resolve(relatedQuestions);
        }catch(err){
            reject(err);
        }
    });
}

function getQuoraQuestions(keyword,location){
    return new Promise(async (resolve,reject)=>{
        try{
            const response = await apiCalls.hitValueSerp(keyword,location,true);
            let quoraQuestions = [];
            let MAXIMUM_QUORA_QUESTIONS = 8;
            if(response.data.organic_results){
                for(let el of response.data.organic_results){
                    if(el.title){
                        quoraQuestions.push(el.title.replace(/\s(-|:)\s(\w+\b){0,}(\/\w+){0,}/g," ").trim());
                    }
                    if(quoraQuestions.length === MAXIMUM_QUORA_QUESTIONS){
                        break;
                    }
                }
            }
            resolve(quoraQuestions);
        }catch(err){
            reject(err);
        }
    });
}

async function getAIQuestions(keyword,usecase){
    try{
        const result = await generateService.generate({topic:keyword},usecase);
        let aiQuestions = result[0].text.trim();
        aiQuestions = aiQuestions.split("\n");
        return aiQuestions;
    }catch(err){
        throw err;
    }
}

async function getAIHeadings(keyword,usecase){
    try{
        const result = await generateService.generate({topic:keyword},usecase);
        let aiHeadings = result[0].text.trim();
        aiHeadings = aiHeadings.split("\n");
        return aiHeadings;
    }catch(err){
        throw err;
    }
}

async function getAllQuestionsAndHeadings(keyword,location,usecases){
    const aiQuestions = getAIQuestions(keyword,usecases[0]);
    const aiHeadings = getAIHeadings(keyword,usecases[1]);
    const relatedQuestions = getRelatedQuestions(keyword,location);
    const quoraQuestions =  getQuoraQuestions(keyword,location);
    const result = await Promise.all([relatedQuestions,quoraQuestions,aiQuestions,aiHeadings]);
    return {
        keyword,
        relatedQuestions : result[0],
        quoraQuestions : result[1],
        aiQuestions : result[2],
        aiHeadings : result[3]
    };
}

async function getQuestionsAnswers(questions,usecase){
    try{
        let questionsAnswers = [];
        let promises = [];
        questions.map(el=>{
            promises.push(generateService.generate({question:el},usecase));
        })
        const answers = await Promise.all(promises);
        for(let i=0;i<questions.length;i++){
            if(answers[i][0].text)
                questionsAnswers.push({
                    question : questions[i],
                    answer : answers[i][0].text.trim()
                });
        }
        return questionsAnswers;
    }catch(err){
        throw err;
    }
}

async function getHeadingsParagraphs(headings,keyword,usecase){
    try{
        let headingsParagraphs = [];
        let promises = [];
        headings.map(el=>{
            promises.push(generateService.generate({topic:keyword,subHeading:el},usecase));
        })
        const paragraphs = await Promise.all(promises);
        for(let i=0;i<headings.length;i++){
            if(paragraphs[i][0].text)
                headingsParagraphs.push({
                    heading : headings[i],
                    paragraph : paragraphs[i][0].text.trim()
                });
        }
        return headingsParagraphs;
    }catch(err){
        throw err;
    }
}

async function getConclusionParagraph(keyword,usecase){
    try{
        const result = await generateService.generate({topic:keyword},usecase);
        let conclusion = result[0].text.trim();
        return conclusion;
    }catch(err){
        throw err;
    }
}


async function getIntroductionParagraph(keyword,usecase){
    try{
        const result = await generateService.generate({topic:keyword},usecase);
        let introductionParagraph = result[0].text.trim();
        introductionParagraph = introductionParagraph.startsWith("Introduction Paragraph:")?introductionParagraph.substring(24):introductionParagraph;
        return introductionParagraph;
    }catch(err){
        throw err;
    }
}


async function getAnswersAndParagraph(keyword,payload,usecases){
    try{
       const relatedQuestionsAnswers = getQuestionsAnswers(payload.relatedQuestions,usecases[2]);
       const aiQuestionAnswers =  getQuestionsAnswers(payload.aiQuestions,usecases[2]);
       const quoraQuestionsAnswers = getQuestionsAnswers(payload.quoraQuestions,usecases[3]);
       const headingsParagraphs =  getHeadingsParagraphs(payload.aiHeadings,keyword,usecases[4]);
       const conclusionParagraph = getConclusionParagraph(keyword,usecases[5]);
       const introductionParagraph = getIntroductionParagraph(keyword,usecases[6]);
       const result = await Promise.all([relatedQuestionsAnswers,aiQuestionAnswers,quoraQuestionsAnswers,headingsParagraphs,conclusionParagraph,introductionParagraph]);

       return {
            relatedQuestionsAnswers:result[0],
            aiQuestionAnswers:result[1],
            quoraQuestionsAnswers:result[2],
            headingsParagraphs:result[3],
            conclusionParagraph:result[4],
            introductionParagraph:result[5]
        };
    }catch(err){
        throw err;
    }

}

async function createArticle(userId,keyword,location){
    let articleId;
    try{
        const article = await Article.saveArticle({user_id:userId,keyword,location,status:ARTICLE.STATUS.IN_PROGRESS});
        articleId = article.insertId;
        const usecases = await generateService.getAllUsecases();
        const questionsHeadings = await getAllQuestionsAndHeadings(keyword,location,usecases);
        let  result = await getAnswersAndParagraph(keyword,questionsHeadings,usecases);
        
        await Article.saveArticleInfo({
            user_id : userId,
            article_id:articleId,
            related_questions: JSON.stringify(result.relatedQuestionsAnswers),
            ai_questions: JSON.stringify(result.aiQuestionAnswers),
            quora_questions: JSON.stringify(result.quoraQuestionsAnswers),
            headings_paragraph : JSON.stringify(result.headingsParagraphs),
            conclusion_paragraph : result.conclusionParagraph,
            introduction_paragraph : result.introductionParagraph
        });
        await Article.updateArticle({
            user_id : userId,
            article_id:articleId,
            fields:{
                status:ARTICLE.STATUS.COMPLETED
            }
        })
        return articleId;
    }catch(err){
        if(articleId){
            await Article.updateArticle({
                user_id : userId,
                article_id:articleId,
                fields:{
                    status:ARTICLE.STATUS.FAILED
                }
            })
        }
        console.log("Error in createArticle",err);
        throw new ApiError(httpStatus.BAD_REQUEST,ARTICLE.ERROR.CREATION_FAILED);
    }
}

async function getArticle(userId,articleId){
    try{
        const [articleInfo] = await Article.getArticleInfo({
            user_id : userId,
            article_id:articleId
        })
        if(articleInfo){
            return articleInfo;
        }else{
            throw new ApiError(httpStatus.NOT_FOUND,ARTICLE.ERROR.NOT_FOUND);
        }
    }catch(err){
        console.log("getArticle",err);
        if(err.statusCode == httpStatus.NOT_FOUND)
            throw err;
        throw new ApiError(httpStatus.BAD_REQUEST,ARTICLE.ERROR.FETCH_FAILED);
    }
}

async function getAllArticles(userId){
    try{
        const articles = await Article.getAllArticlesByUserId({
            user_id : userId
        })
        if(articles){
            return articles;
        }else{
            throw new ApiError(httpStatus.NOT_FOUND ,ARTICLE.ERROR.NOT_FOUND);
        }
    }catch(err){
        console.log("getAllArticles",err);
        if(err.statusCode == httpStatus.NOT_FOUND)
            throw err;
        throw new ApiError(httpStatus.BAD_REQUEST,ARTICLE.ERROR.FETCH_FAILED);
    }
}
module.exports = {
    createArticle,
    getArticle,
    getAllArticles
}