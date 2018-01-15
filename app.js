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

const participants = require('./participants.json')
const treatments = require('./treatments.json')
const texts = require('./texts.json')

app.get('/signup', function(req, res, next) {
  if(!treatments[md5(req.query.participant_id)]){
    res.send('err') //TODO: Handle wrong pid
    return console.log('No treatment for ' + req.query.participant_id)
  }
  res.data = {}
  req.session.participant_id = req.query.participant_id
  res.data.participant_id = req.session.participant_id
  req.session.treatment = treatments[treatments[md5(req.session.participant_id)]]
  req.session.round = 0
  req.session.stage = 0
  req.session.times = []

  res.render('signup', res.data)
})

app.get('/questions', function(req, res, next) {
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
    req.session.times.push((new Date().getTime()))
  }
  res.data = {}
  res.data.participant_id = req.session.participant_id
  res.data.text = texts[req.session.treatment[req.session.round]]

  res.render('text', res.data)
})


app.get('/round_end', function(req, res, next) {


  //TODO: log answers
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
  res.render('done', res.data)
})




app.listen(3000)
