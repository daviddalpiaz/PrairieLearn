var fs = require('fs');
var _ = require('underscore');
var async = require('async');
var moment = require('moment-timezone');
var csvStringify = require('csv').stringify;

var sqldb = require('../../sqldb');
var config = require('../../config');
var db = require('../../db');

module.exports = {
    sync: function(courseInfo, callback) {
        var that = module.exports;
        var filename = "/tmp/submissions.csv";
        that.readExistingIds(function(err, existingIds) {
            if (err) return callback(err);
            that.mongoToFile(filename, courseInfo, existingIds, function(err) {
                if (err) return callback(err);
                that.fileToSQL(filename, callback);
            });
        });
    },
        
    readExistingIds: function(callback) {
        var sql = 'SELECT sid FROM submissions;';
        sqldb.query(sql, [], function(err, result) {
            if (err) return callback(err);
            var existingIds = {};
            _(result.rows).each(function(row) {
                existingIds[row.sid] = true;
            });
            callback(null, existingIds);
        });
    },

    mongoToFile: function(filename, courseInfo, existingIds, callback) {
        fs.open(filename, "w", function(err, fd) {
            if (err) return callback(err);
            db.sCollect.find({}, function(err, cursor) {
                if (err) return callback(err);
                var done = false;
                async.doUntil(function(callback) {
                    cursor.next(function(err, obj) {
                        if (err) return callback(err);
                        if (obj == null) {
                            done = true;
                            return callback(null);
                        }
                        if (existingIds[obj.sid]) {
                            // already have this object in the SQL DB, skip it
                            return callback(null);
                        }
                        csvData = [[
                            obj.sid,
                            moment(obj.date).tz(config.timezone).format(),
                            obj.uid,
                            obj.qiid,
                            obj.score,
                            obj.overrideScore,
                            (obj.practice ? 'practice' : 'score'),
                            (obj.feedback ? JSON.stringify(obj.feedback).replace(/\\u0000/g, '') : ''),
                            (obj.submittedAnswer ? JSON.stringify(obj.submittedAnswer).replace(/\\u0000/g, '') : ''),
                        ]];
                        csvStringify(csvData, function(err, csv) {
                            if (err) return callback(err);
                            fs.write(fd, csv, callback);
                        });
                    });
                }, function() {return done;}, callback);
            });
        });
    },

    fileToSQL: function(filename, callback) {
        // load import data into a temporary table
        var sql
            = ' DROP TABLE IF EXISTS submissions_import;'
            + ' CREATE TABLE submissions_import ('
            + '     sid VARCHAR(255),'
            + '     date TIMESTAMP WITH TIME ZONE,'
            + '     uid VARCHAR(255),'
            + '     qiid VARCHAR(255),'
            + '     score DOUBLE PRECISION,'
            + '     override_score DOUBLE PRECISION,'
            + '     type enum_submission_type,'
            + '     feedback JSONB,'
            + '     submitted_answer JSONB'
            + ' );'
            + ' COPY submissions_import (sid, date, uid, qiid, score, override_score, type, feedback, submitted_answer)'
            + ' FROM \'' + filename + '\' WITH (FORMAT CSV);';
        sqldb.query(sql, [], function(err) {
            if (err) return callback(err);
            // create new submissions from imported data
            var sql
                = ' INSERT INTO submissions (sid, date, question_instance_id, auth_user_id, submitted_answer, type,'
                + '                          override_score, open, credit, mode)'
                + ' ('
                + '     SELECT si.sid, si.date, qi.id, u.id, si.submitted_answer, si.type, si.override_score, NULL, NULL, NULL'
                + '     FROM submissions_import AS si'
                + '     JOIN users AS u ON (u.uid = si.uid)'
                + '     JOIN question_instances AS qi ON (qi.qiid = si.qiid)'
                + ' )'
                + ' ON CONFLICT DO NOTHING;';
            sqldb.query(sql, [], function(err) {
                if (err) return callback(err);
                // create new gradings from imported data
                var sql
                    = ' INSERT INTO gradings (date, submission_id, auth_user_id, score, feedback)'
                    + ' ('
                    + '     SELECT si.date, s.id, u.id, si.score, si.feedback'
                    + '     FROM submissions_import AS si'
                    + '     JOIN submissions AS s ON (s.sid = si.sid)'
                    + '     JOIN users AS u ON (u.uid = si.uid)'
                    + ' )'
                    + ' ON CONFLICT DO NOTHING;';
                sqldb.query(sql, [], function(err) {
                    if (err) return callback(err);
                    // create new question scores from imported data
                    var sql
                        = " INSERT INTO question_scores (date, grading_id, question_instance_id, test_score_id, auth_user_id,"
                        + "                              points, max_points)"
                        + " ("
                        + "     SELECT si.date, g.id, qi.id, ts.id, u.id,"
                        + "            CASE"
                        + "                WHEN t.type = 'Exam' AND g.score >= 0.5"
                        + "                    THEN 1"
                        + "                WHEN t.type = 'Exam' AND g.score < 0.5"
                        + "                    THEN 0"
                        + "                WHEN t.type = 'RetryExam'"
                        + "                    THEN jsonb_extract_path_text(ti.obj, 'questionsByQID', q.qid, 'awardedPoints')::DOUBLE PRECISION"
                        + "                WHEN t.type = 'Game'"
                        + "                    THEN jsonb_extract_path_text(ti.obj, 'qData', q.qid, 'score')::DOUBLE PRECISION"
                        + "                WHEN t.type = 'Basic'"
                        + "                    THEN jsonb_extract_path_text(ti.obj, 'qData', q.qid, 'avgScore')::DOUBLE PRECISION"
                        + "            END,"
                        + "            CASE"
                        + "                WHEN t.type = 'Exam'"
                        + "                    THEN 1"
                        + "                WHEN t.type = 'RetryExam'"
                        + "                    THEN jsonb_extract_path_text(ti.obj, 'questionsByQID', q.qid, 'points', '0')::DOUBLE PRECISION"
                        + "                WHEN t.type = 'Game'"
                        + "                    THEN jsonb_extract_path_text(t.obj, 'qParams', q.qid, 'maxScore')::DOUBLE PRECISION"
                        + "                WHEN t.type = 'Basic'"
                        + "                    THEN 1"
                        + "            END"
                        + "     FROM submissions_import AS si"
                        + "     JOIN submissions AS s ON (s.sid = si.sid)"
                        + "     JOIN gradings AS g ON (g.submission_id = s.id)"
                        + "     JOIN users AS u ON (u.uid = si.uid)"
                        + "     JOIN question_instances AS qi ON (qi.id = s.question_instance_id)"
                        + "     JOIN test_instances AS ti ON (ti.id = qi.test_instance_id)"
                        + "     JOIN test_questions AS tq ON (tq.id = qi.test_question_id)"
                        + "     JOIN questions AS q ON (q.id = tq.question_id)"
                        + "     JOIN tests AS t ON (t.id = tq.test_id)"
                        + "     JOIN ("
                        + "         SELECT DISTINCT ON (test_instance_id) *"
                        + "         FROM test_scores"
                        + "         ORDER BY test_instance_id, date DESC, id"
                        + "     ) AS ts ON (ts.test_instance_id = ti.id)"
                        + " )"
                        + " ON CONFLICT DO NOTHING;";
                    sqldb.query(sql, [], callback);
                });
            });
        });
    },
};
