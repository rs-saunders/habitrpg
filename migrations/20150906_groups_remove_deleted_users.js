/*
 * Remove deleted accounts from groups
 */

var mongo = require('mongoskin');
var async = require('async');

var dbserver = 'url';
var dbname = 'dbname';
var countGroups = 0;
var countUsers = 0;

var db = mongo.db(dbserver + '/' + dbname + '?auto_reconnect');
var dbUsers = db.collection('users');
var dbGroups = db.collection('groups');

console.log('Begins work on db');

function findGroups(gt){
  var query = {};
  if(gt) query._id = {$gt: gt};

  console.log(query)

  dbGroups.find(query, {
    fields: {_id: 1, members: 1},
    limit: 10000,
    sort: {
      _id: 1
    }
  }).toArray(function(err, groups){
    if(err) throw err;

    var lastGroup = null;
    if(groups.length === 10000){
      lastGroup = groups[groups.length - 1];
    }

    async.eachLimit(groups, 3, function(group, cb1){
      countGroups++;
      console.log('Group: ', countGroups, group._id);

      var members = group.members;

      // Remove users who deleted their account
      async.eachLimit(members, 15, function(member, cb2){
        dbUsers.findOne({_id: member}, {fields: {_id: 1}}, function(err, user){
          if(err) return cb2(err);

          if(!user){
            countUsers++;
            console.log('User removed n. ', countUsers, 'user id ', member, 'group id ', group._id);

            dbGroups.update({
              _id: group._id
            }, {
              $pull: {members: member},
              $inc: {memberCount: -1}
            }, {
              multi: false
            }, function(err, res){
              if(err) return cb2(err);

              console.log('Updated: ', res);
              return cb2();
            });
          }else{
            cb2();
          }
        });
      }, function(err){
        if(err) return cb1(err);

        cb1();
      });

    }, function(err){
      if(err) throw err;

      if(lastGroup && lastGroup._id){
        findGroups(lastGroup._id);
      }
    });
  });
};

findGroups();