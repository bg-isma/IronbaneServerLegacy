// forum.js
module.exports = function(app, db) {
    var log = require('util').log,
        Forum = require('../../entity/forum')(db),
        Board = require('../../entity/board')(db);


        app.get('/api/forum', function(req, res) {
            Forum.get().then(function(forum) {

                res.send(forum);
            }, function(error){
                res.send(error, 500);
            });
        });

    // create a new board
    app.post('/api/forum', function(req, res) {
        var board = {
            name: req.body.name,
            forumcat: req.body.forumcat || 1,
            description: req.body.description
        };
        // todo: session auth
        db.query('insert into forum_boards set ?', board, function(err, results) {
            res.send(results);
        });
    });

    app.get('/api/onlineusers', function(req, res) {
        log('getting online users');
        db.query('SELECT name from bcs_users WHERE last_session > '+  (Date.now()/1000 - 86400) + ' ORDER BY last_session', function(err,results) {
             if(err) {
                    log('SQL error getting onlineusers: ' + err);
                    res.send(500, 'Error getting onlineusers!');
                    return;
                }
                log("online users: "+ results);
            res.send(results);
        });
    })

    // get a single board
    app.get('/api/forum/:boardId', function(req, res) {
        if(req.params.boardId === 'news') {
            db.query('SELECT a.* from (SELECT * FROM forum_posts ORDER BY time ASC) as a, (SELECT * FROM forum_topics where board_id = 7) as b WHERE a.topic_id = b.id GROUP BY topic_id ORDER BY time DESC LIMIT 10', function(err, results) {
                if(err) {
                    log('SQL error getting news: ' + err);
                    res.send(500, 'Error getting news posts!');
                    return;
                }

                var posts = [];
                results.forEach(function(p) {
                    bbcode.parse(p.content, function(html) {
                        p.content = html;
                    });
                    posts.push(p);
                });

                res.send(posts);
            });
        } else {
            db.query('select * from forum_boards where id = ?', [req.params.boardId], function(err, results) {
                if(err) {
                    res.send(500, 'DB Error getting posts!');
                    console.log('DB error getting posts: ', err);
                    return;
                }

                if(results.length > 0) {
                    res.send(results[0]);
                } else {
                    res.send(404, "no board found with id " + req.params.boardId);
                }
            });
        }
    });

    // get all topics for a board
    app.get('/api/forum/:boardId/topics', function(req, res) {
        var func = arguments;
         db.query('SELECT forum_topics.id, MIN(forum_posts.time) AS firstposttime, (COUNT(forum_posts.id) - 1 ) as postcount, bcs_users.name AS username, forum_topics.title FROM forum_topics INNER JOIN forum_posts ON forum_topics.id = forum_posts.topic_id INNER JOIN bcs_users ON forum_posts.user = bcs_users.id WHERE forum_topics.private = 0 and board_id = ? GROUP BY forum_topics.id ', [req.params.boardId], function(err, results){
                log(func.callee.name);
                res.send(results);
            }, function(error){
                res.send(error, 500);
            });
        });

    // start a new topic
    app.post('/api/forum/:boardId/topics', function(req, res) {
        db.query('insert into forum_topics set board_id = ?, time = ?', [req.params.boardId, req.body.time], function(err, topicResult) {
            if(err) {
                res.send('error creating topic', 500);
                return;
            }

            var topicId = topicResult.insertId,
                post = {
                    topic_id: topicId,
                    title: req.body.title,
                    content: req.body.bbcontent,
                    time: req.body.time,
                    user: req.body.user
                };

            db.query('insert into forum_posts set ?', post, function(err, result) {
                if(err) {
                    res.send('error creating post', 500);
                    return;
                }
                res.send(result);
            });
        });
    });

    // get all posts for topic
    app.get('/api/forum/topics/:topicId', function(req, res) {
        db.query('select * from forum_posts where topic_id = ? order by time asc', [req.params.topicId], function(err, results) {
            if(err) {
                res.end('error', err);
                return;
            }

            // skip authors phase if there aren't any results
            if(results.length === 0) {
                res.send([]); // send 404 instead?
                return;
            }

            var authors = [];

            var posts = results;

            posts.forEach(function(post) {
                authors.push(post.user);
                post.bbcontent = post.content;
                bbcode.parse(post.content, function(html) {
                    post.content = html;
                });
            });

            // grab author details to populate
            db.query('select * from bcs_users where id in (?)', [authors], function(err, users) {
                if(err) {
                    res.send('error loading users: ' + err, 500);
                    return;
                }

                // loop through posts and nest author
                posts.forEach(function(post) {
                    for(var i=0;i<users.length;i++) {
                        if(post.user === users[i].id) {
                            post.author = users[i];
                            // don't send password or activationkey
                            delete post.author.pass;
                            delete post.author.activationkey;
                            break;
                        }
                    }
                });

                res.send(posts);
            });
        });
    });

    // create a new post
    app.post('/api/forum/topics/:topicId', function(req, res) {
        var post = {
            topic_id: req.params.topicId,
            title: req.body.title,
            content: req.body.bbcontent,
            time: req.body.time,
            user: req.body.user
        };

        db.query('insert into forum_posts set ?', post, function(err, result) {
            if(err) {
                res.send('error creating post', 500);
                return;
            }
            res.send(result);
        });
    });
};