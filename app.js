const express = require('express')
const fs = require('fs')
const md5 = require('md5')
const session = require('express-session')
const mustacheExpress = require('mustache-express')
const cookieParser = require('cookie-parser')
let app = express()

app.engine('mustache', mustacheExpress());

app.set('view engine', 'mustache');
app.set('views', __dirname + '/views');

app.use(cookieParser('secret'));
app.use(session({
  secret: 'secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}))

app.use('/', express.static('public'))

const allParticipants = require('./participants.json')
let participants = allParticipants.invited
let staleInvitations = allParticipants.stale
const treatments = require('./treatments.json')
const texts = require('./texts.json').map((text,idx) => {
  text.idx = idx
  text.content = fs.readFileSync('./texts/' + (idx + 1)).toString().trim().split('\n').map(text => {return {paragraph: text}})
  text.questions = text.questions.map((question, idx) => {
    question.qidx = idx
    // question.answers = question.answers.map((answer, idx) => {
    //   answer.aidx = idx
    //   return answer
    // })
    return question
  })
  return text
})

app.get('/signup', function(req, res, next) {
  if(participants.indexOf(req.query.participant_id) === -1) {
    if(staleInvitations.indexOf(req.query.participant_id) !== -1) {
      return res.render('error', {error_message: "This participant code has expired. Please show this message to an experimenter"})
    }
    if(allParticipants.priviledged.indexOf(req.query.participant_id) === -1) {
      return res.render('error', {error_message: "We cannot recognize this participant number. Try typing it again. If this problem persists, please show this message to an experimenter"})
    }
    console.log('Priviledged user ' + req.query.participant_id + ' granted access')
    
  }
  res.data = {}
  req.session.participant_id = req.query.participant_id
  res.data.participant_id = req.session.participant_id
  req.session.treatment = treatments[treatments[req.session.participant_id]]
  req.session.round = 0
  req.session.stage = 0
  req.session.times = []
  req.session.resultString = req.session.participant_id.substr(0,2) + ',' + (new Date()).toString() + ','

  res.render('signup', res.data)
})


app.use('*', function(req, res, next) {
  if(!req.session.participant_id) {
    return res.redirect('/')
  }
  else next();
})

app.get('/questions', function(req, res, next) {


  if(req.query.answers) {
    console.log(req.query.answers)
    req.session.resultString +=req.query.answers.map(ans => ans.split(',').join('<comma>')) + ','
  }

  if(req.session.round >= req.session.treatment.length) {
    return res.redirect('/done')
  }

  res.data = {}
  res.data.participant_id = req.session.participant_id
  res.data.text = texts[req.session.treatment[req.session.round]]

  res.render('questions', res.data)
})

app.get('/text', function(req, res, next) {
  if(req.session.stage % 2 == 0) {
    req.session.stage += 1
    req.session.resultString += treatments.sizes[treatments[req.session.participant_id]][req.session.round] + ','
    req.session.times.push((new Date().getTime()))
  }
  res.data = {}
  res.data.participant_id = req.session.participant_id
  res.data.text = texts[req.session.treatment[req.session.round]]
  res.data.text.class = treatments.sizes[treatments[req.session.participant_id]][req.session.round]

  res.render('text', res.data)
})


app.get('/round_end', function(req, res, next) {

  res.data = {}
  res.data.participant_id = req.session.participant_id
  res.data.text = texts[req.session.treatment[req.session.round]]
  res.data.rounds_left = req.session.treatment.length - req.session.round - 1



  if(req.session.stage % 2 == 1) {
    req.session.stage += 1
    req.session.times.push((new Date().getTime()))
    req.session.round += 1

  }

  res.render('answers', res.data);


})

app.get('/done', function(req, res, next) {
  res.data = {}
  res.data.participant_id = req.session.participant_id
  fs.appendFileSync('results/' + req.session.treatment, req.session.resultString + req.session.times + '\n')

  res.render('done', res.data)

  staleInvitations.push(participants.splice(participants.indexOf(req.session.participant_id),1)[0])
  fs.writeFileSync('./participants.json', JSON.stringify({invited: participants, stale: staleInvitations, priviledged: allParticipants.priviledged}, null, 4))

  req.session.destroy()

})

app.listen(3000)
