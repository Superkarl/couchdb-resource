angular.module('dbResource', []).factory('dbResource', ['DB_CONFIG', 'APP_CONFIG', '$http', '$q', 'security', function (DB_CONFIG, APP_CONFIG, $http, $q, security) {
    var securityModule = null;

    function DbResourceFactory(collectionName) {

        /**
         * If a user is authenticated, returns the URL of his current database.
         * If no current Database is set, it looks for a default database.
         * If no default is given or if not authenticated, returns false.
         *
         * @returns String url
         */

        var getUrl = function () {
            if (!!security.isAuthenticated()) {
                if (!!security.currentUser.currentDbName) {
                    return DB_CONFIG.baseUrl + '/' + security.currentUser.currentDbName;}
                else if (!!DB_CONFIG.dbName_default) {
                    return DB_CONFIG.baseUrl + '/' + DB_CONFIG.dbName_default; }
                else {
                    return false;}
            } else {
                return false;}
        };
        var defaultParams = {};
        if (DB_CONFIG.apiKey) {
            defaultParams.apiKey = DB_CONFIG.apiKey;
        }

        function encodeUri(base, part1, part2) {
            var uri = base;
            if (part1) uri = uri + "/" + encodeURIComponent(part1);
            if (part2) uri = uri + "/" + encodeURIComponent(part2);
            return uri.replace('%2F', '/');
        }

        var thenFactoryMethod = function (httpPromise, successcb, errorcb, isArray) {
            var scb = successcb || angular.noop;
            var ecb = errorcb || angular.noop;


            var result = {
                rows: [],
                prevRows: [],
                nextRow: [],
                queryActive: false
            };

            return httpPromise.then(function (response) {

                // Pop extra row for pagination
                if (response.config.params && response.config.params.limit) {
                    if (response.data.rows.length === response.config.params.limit) {
                        result.nextRow = response.data.rows.pop();
                    }
                    else {
                        result.nextRow = null;
                    }
                }
                /* if (config.append) {
                 for (var i in data.rows) response.rows.push(data.rows[i]);
                 delete response.qConfig.append;
                 }
                 else {*/
                //response.rows = data.rows;
                /*}*/

                if (isArray) {
                    result.rows = [];
                    for (var i = 0; i < response.data.rows.length; i++) {
                        result.rows.push(new Resource(response.data.rows[i]));
                    }
                } else {
                    //Db has rather peculiar way of reporting not-found items, I would expect 404 HTTP response status...
                    if (response.data === "null") {
                        return $q.reject({
                            code: 'resource.notfound',
                            collection: collectionName
                        });
                    } else {
                        result = new Resource(response.data);
                    }
                }
                scb(result, response);
                return result;
            }, function (response) {
                ecb(undefined, response);
                result.queryActive = false;
                return $q.reject({
                    code: response.data.error,
                    reason: response.data.reason,
                    collection: collectionName
                });
            });
        };

        var getParams = function(qparams) {
            var config = {};
            if (qparams) {
                // Raise limit by 1 for pagination
                if (qparams.limit) qparams.limit++;
                // Convert key parameters to JSON
                for (p in qparams) switch (p) {
                    case "key":
                    case "keys":
                    case "startkey":
                    case "endkey":
                        qparams[p] = angular.toJson(qparams[p]);
                }
            }
            return qparams;
        };

        var executeQuery = function(db, httpPromise, successcb, errorcb, isArray) {

            db.queryActive = true;
            var scb = successcb || angular.noop;
            var ecb = errorcb || angular.noop;

            return httpPromise.then(
                function(data, dt, hd, config){
                    // Pop extra row for pagination
                    if (config.params && config.params.limit) {
                        if (data.rows.length === config.params.limit) {
                            db.nextRow = data.rows.pop();
                        }
                        else {
                            db.nextRow = null;
                        }
                    }
                    if (config.append) {
                        for (var i in data.rows) db.rows.push(data.rows[i]);
                        delete db.qConfig.append;
                    }
                    else {
                        db.rows = data.rows;
                    }
                    db.queryActive = false;

                    scb(result, data);
                    return result;
                },
                function(error){
                    var ecb = errorcb || angular.noop;
                    ecb(undefined, undefined);
                    return $q.reject({
                        code: error.data.error,
                        collection: collectionName
                    });
                }
            );
        };

        var docResource = function(init){
            angular.copy(init || {}, this);
        };
        docResource.prototype.load = function(successcb, errorcbid, docParams) {

            var url = getUrl();
            if (url) {
                var httpPromise = $http.get(url + '/' + id, {params: defaultParams});
                return thenFactoryMethod(httpPromise, successcb, errorcb);
            } else {
                var ecb = errorcb || angular.noop;
                ecb(undefined, undefined);
                return $q.reject({
                    code: 'url.notdefined',
                    collection: collectionName
                });
            }


            var config = {
                method: getMethod,
                url:    encodeUri(url(), id || this._id)
            };
            if (docParams) config.params = docParams;
            var doc = this;
            return $http(extendJSONP(config)).success( function (data) {
                angular.copy(data, doc);
            });
        };






        var Resource = function (data) {
            angular.extend(this, data);
        };

        Resource.allOld = function (cb, successcb, errorcb) {

            var params = {};
            var url = getUrl();
            if (url) {
                // $http.get(appSettings.db + '/angular-cornercouch/_design/all/_view/projects');
                var httpPromise = $http.get(url + '/_design/all/_view/' + collectionName,
                    {params: angular.extend({}, defaultParams, params)});
                return thenFactoryMethod(httpPromise, successcb, errorcb, true);
            } else {
                var ecb = errorcb || angular.noop;
                ecb(undefined, undefined);
                return $q.reject({
                    code: 'url.notdefined',
                    collection: collectionName
                });
            }


            //return Resource.query({}, cb, errorcb);
        };

        Resource.all = function(qparams, successcb, errorcb) {
            var url = getUrl();
            if (url) {
                var httpPromise = $http.get(
                    url + '/_all_docs/',
                    {params: angular.extend({}, defaultParams, getParams(qparams))});
                return thenFactoryMethod(httpPromise, successcb, errorcb, true);
            } else {
                var ecb = errorcb || angular.noop;
                ecb(undefined, undefined);
                return $q.reject({
                    code: 'url.notdefined',
                    collection: collectionName
                });
            }
        };



        // Users.query('users.email.unique',viewValue, function(){}, function(){})
        Resource.queryOld = function (filterName, value, successcb, errorcb) {
            var params = {group: true, key: '"' + value + '"'};
            var url = getUrl();
            if (url) {
                var httpPromise = $http.get(url + '/_design/filter/_view/' + filterName, {params: angular.extend({}, defaultParams, params)});
                return thenFactoryMethod(httpPromise, successcb, errorcb, true);
            } else {
                var ecb = errorcb || angular.noop;
                ecb(undefined, undefined);
                return $q.reject({
                    code: 'url.notdefined',
                    collection: collectionName
                });
            }
        };

        Resource.getById = function (id, successcb, errorcb) {
            var url = getUrl();
            if (url) {
                var httpPromise = $http.get(url + '/' + id, {params: defaultParams});
                return thenFactoryMethod(httpPromise, successcb, errorcb);
            } else {
                var ecb = errorcb || angular.noop;
                ecb(undefined, undefined);
                return $q.reject({
                    code: 'url.notdefined',
                    collection: collectionName
                });
            }
        };

        //instance methods

        //DB Info
        Resource.prototype.getInfo = function () {
            var db = this;
            var url = getUrl();
            if (url) {
                return $http({
                    method: "GET",
                    url: url + "/"
                })
                    .success(function (data) {
                        db.info = data;
                    });
            } else {
                var ecb = errorcb || angular.noop;
                ecb(undefined, undefined);
                return $q.reject({
                    code: 'url.notdefined',
                    collection: collectionName
                });
            }
        };

        Resource.prototype.queryView = function(viewURL, qparams) {
            var config = {
                method: this.method,
                url:    this.uri + viewURL
            };

            if (qparams) {
                // Raise limit by 1 for pagination
                if (qparams.limit) qparams.limit++;
                // Convert key parameters to JSON
                for (p in qparams) switch (p) {
                    case "key":
                    case "keys":
                    case "startkey":
                    case "endkey":
                        qparams[p] = ng.toJson(qparams[p]);
                }
                config.params = qparams;
            }

            this.qConfig = extendJSONP(config);
            return executeQuery(this);
        };



        //scope.gbookdb.query("filter", "users.email.unique", { include_docs: true, descending: true, limit: 2 });
        Resource.query = function(design, view, qparams, successcb, errorcb) {
            // no Admin -> gStatus=true only
            var _noAdmin = {};
            if(!security.isAdmin() && design == 'all'){
                design = 'gActive';
            }
            var url = getUrl();
            if (url) {
                var httpPromise = $http.get(
                    url + '/_design/'+encodeURIComponent(design)+'/_view/' + encodeURIComponent(view),
                    {params: angular.extend({}, defaultParams, getParams(qparams))});
                return thenFactoryMethod(httpPromise, successcb, errorcb, true);
            } else {
                var ecb = errorcb || angular.noop;
                ecb(undefined, undefined);
                return $q.reject({
                    code: 'url.notdefined',
                    collection: collectionName
                });
            }
        };

        //scope.gbookdb.query("filter", "users.email.unique", { include_docs: true, descending: true, limit: 2 });
        //Users.query("_users", "all", "users" {include_docs: false, descending: true})
        Resource.queryIndividual = function(db, design, view, qparams, successcb, errorcb) {
            // no Admin -> gStatus=true only
            var _noAdmin = {};
            if(!security.isAdmin() && design == 'all'){
                design = 'gActive';
            }
            var url = DB_CONFIG.baseUrl + '/' + db;
            if (url) {
                var httpPromise = $http.get(
                    url + '/_design/'+encodeURIComponent(design)+'/_view/' + encodeURIComponent(view),
                    {params: angular.extend({}, defaultParams, getParams(qparams))});
                return thenFactoryMethod(httpPromise, successcb, errorcb, true);
            } else {
                var ecb = errorcb || angular.noop;
                ecb(undefined, undefined);
                return $q.reject({
                    code: 'url.notdefined',
                    collection: collectionName
                });
            }
        };

        //scope.gbookdb.list("filter", "users.email.unique", { include_docs: true, descending: true, limit: 2 });
        Resource.list = function(design, list, view, qparams, successcb, errorcb) {
            var url = getUrl();
            if (url) {
                var httpPromise = $http.get(
                    url + '/_design/'+encodeURIComponent(design)+'/_list/' + encodeURIComponent(list) + '/'+ encodeURIComponent(view),
                    {params: angular.extend({}, defaultParams, getParams(qparams))});
                return thenFactoryMethod(httpPromise, successcb, errorcb, true);
            } else {
                return $q.reject({
                    code: 'url.notdefined',
                    collection: collectionName
                });
            }
        };

        Resource.prototype.$id = function () {
            if (this._id) {
                return this._id;
            }
            if (this.id) {
                return this.id;
            }
        };
        Resource.prototype.$rev = function () {
            if (this._rev) {
                return this._rev;
            }
            if (this.value.hasOwnProperty('_rev')) {
                return this.value._rev;
            }
        };

        Resource.prototype.$attach = function(successcb, errorcb) {
            var doc = this;

            var saveAttach = function(uuid, attachId, successcb, errorcb){
                var url = getUrl();
                if (url) {
                    var data = {
                        '_id': uuid,
                        'name': doc.file.filename,
                        'url': attachId,
                        'isImage': doc.file.isImage,

                    };
                    if(doc.$id()){
                        data.meta_key = Object.assign(doc.meta_key, {
                            'updated_at':new Date().toJSON(),
                            'updated_by':security.currentUser['name'],
                            'version':APP_CONFIG.version
                        });
                        data.parent = doc.$id();
                    }else{
                        data.meta_key = {
                            'created_at': new Date().toJSON(),
                            'created_by': security.currentUser['name'],
                            'version': APP_CONFIG.version,
                        };
                        data.parent = "";
                    }
                    data._attachments = {};
                    if(data.isImage){
                        data._attachments[attachId] = {
                            'content_type': doc.file.filetype,
                            'data': doc.file.org.base64
                        };
                        data._attachments[attachId+'_thumb'] = {
                            'content_type': doc.file.filetype,
                            'data': doc.file.thumb.base64
                        };
                    }else{
                        data._attachments[attachId] = {
                            'content_type': doc.file.filetype,
                            'data': doc.file.org.base64
                        };
                    }
                    data.content_type = doc.file.filetype;
                    data.mediadir = Object.assign({}, doc.mediadir);


                    var httpPromise = $http({
                        method: "PUT",
                        url: encodeUri(url, uuid),
                        data: data,
                        params: defaultParams
                    });
                    return thenFactoryMethod(httpPromise, successcb, errorcb);
                } else {
                    return $q.reject({
                        code: 'url.notdefined',
                        collection: collectionName
                    });
                }
            };

            this.getUUIDs(2).then(
                function(uuids){
                    return saveAttach(uuids[0], uuids[1], successcb, errorcb);
                },
                function(error){
                    errorcb(undefined, error);
                    return $q.reject({
                        code: error.data.error,
                        collection: collectionName
                    });
                }
            );

            /*
             if (this.$id()) {
             return saveAttach(this.$id(), Object.keys(doc._attachments), successcb, errorcb);
             } else {
             this.getUUIDs(2).then(
             function(uuids){
             return saveAttach(uuids[0], uuids[1], successcb, errorcb);
             },
             function(error){
             errorcb(undefined, error);
             return $q.reject({
             code: error.data.error,
             collection: collectionName
             });
             }
             );
             }
             */
            /*this.getUUIDs(1).then(
             function(uuids){
             var data = {
             'name': doc.file.filename,
             'url': '|D-'+new Date().toJSON()+'|V-'+APP_CONFIG.version+'|U-'+security.currentUser['name']+'|N-'+ doc.file.filename,
             '_id': uuids[0]
             };
             data.meta_key = {
             'created_at': new Date().toJSON(),
             'created_by': security.currentUser['name'],
             'version': APP_CONFIG.version,
             };
             data._attachments = {};
             data._attachments[data.url] = {
             'content_type': doc.file.filetype,
             'data': doc.file.base64
             };

             var httpPromise = $http({
             method: "PUT",
             url: encodeUri(url, uuids[0]),
             data: data,
             params: defaultParams
             });
             return thenFactoryMethod(httpPromise, successcb, errorcb);
             },
             function(error){
             errorcb(undefined, error);
             return undefined;
             }
             );*/

        };

        Resource.prototype.attachMulti = function(files, successcb, errorcb) {
            var doc = this;
            var idx = 0;
            function loopCB() {
                if (idx < files.length)
                    doc.attach(files[idx], ++idx < files.length ? loopCB : successcb, errorcb);
            };
            loopCB();
        }

        Resource.prototype.$save = function (successcb, errorcb) {

            // @url https://ehealthafrica.github.io/couchdb-best-practices/#useful-meta-keys
            /**
             * created_at: Date of creation date.toJSON()
             * created_by: Username of creator
             * version: Document schema version
             */
            var url = getUrl();
            if (url) {
                this.meta_key = {};
                this.meta_key['created_at'] = new Date().toJSON();
                this.meta_key['created_by'] = security.currentUser['name'];
                this.meta_key['version'] = APP_CONFIG.version;
                this.gActive = true;

                var httpPromise = $http({
                    method: "POST",
                    url: url,
                    data: angular.extend({}, this, {type: collectionName}),
                    params: defaultParams
                });
                return thenFactoryMethod(httpPromise, successcb, errorcb);
            } else {
                var ecb = errorcb || angular.noop;
                ecb(undefined, undefined);
                return $q.reject({
                    code: 'url.notdefined',
                    collection: collectionName
                });
            }
        };

        Resource.prototype.$update = function (successcb, errorcb) {

            // @url https://ehealthafrica.github.io/couchdb-best-practices/#useful-meta-keys
            /**
             * updated_at: Date of last update date.toJSON()
             * updated_by: Username of last updater
             * version: Document schema version
             */
            var url = getUrl();
            if (url) {
                if(this.hasOwnProperty('meta_key')) {
                    this.meta_key['updated_at'] = new Date().toJSON();
                    this.meta_key['updated_by'] = security.currentUser['name'];
                    this.meta_key['version'] = APP_CONFIG.version;
                }
                if(!this.hasOwnProperty('gActive')) {
                    this.gActive = true;
                }
                var httpPromise = $http({
                    method: "PUT",
                    url: encodeUri(url, this.$id()),
                    data: angular.extend({}, this, {_id: undefined}),
                    params: defaultParams
                });
                return thenFactoryMethod(httpPromise, successcb, errorcb);
            } else {
                var ecb = errorcb || angular.noop;
                ecb(undefined, undefined);
                return $q.reject({
                    code: 'url.notdefined',
                    collection: collectionName
                });
            }
        };

        Resource.prototype.$remove = function (successcb, errorcb) {

            // @url https://ehealthafrica.github.io/couchdb-best-practices/#two-ways-of-deleting-documents
            /**
             * updated_at: Date of last update date.toJSON()
             * updated_by: Username of last updater
             * version: Document schema version
             */
            var url = getUrl();
            if (url) {
                if(this.hasOwnProperty('meta_key')){
                    this.meta_key['updated_at'] = new Date().toJSON();
                    this.meta_key['updated_by'] = security.currentUser['name'];
                    this.meta_key['version'] = APP_CONFIG.version;
                }
                this.gActive = false;

                var httpPromise = $http({
                    method: "PUT",
                    url: encodeUri(url, this.$id()),
                    data: angular.extend({}, this),
                    params: angular.extend({}, defaultParams, {rev: this.$rev()})
                });
                return thenFactoryMethod(httpPromise, successcb, errorcb);
            } else {
                var ecb = errorcb || angular.noop;
                ecb(undefined, undefined);
                return $q.reject({
                    code: 'url.notdefined',
                    collection: collectionName
                });
            }
        };

        Resource.prototype.$saveOrUpdate = function (savecb, updatecb, errorSavecb, errorUpdatecb) {
            if (collectionName == 'attachments'){
                return this.$attach(updatecb, errorUpdatecb);
            }
            if (this.$id()) {
                return this.$update(updatecb, errorUpdatecb);
            } else {
                return this.$save(savecb, errorSavecb);
            }
        };

        Resource.prototype.getUUIDs = function(cnt) {

            /*var server = this;
             return $http ({
             method:     "GET",
             url:        url + "/_uuids",
             params:     { count: cnt || 1 }
             })
             .success(function(data) {
             server.uuids = data.uuids;
             });*/

            var httpPromise = $http.get(
                DB_CONFIG.baseUrl + '/_uuids',
                {params: angular.extend({}, defaultParams, { count: cnt || 1 })}).then(
                function(data){
                    return data.data.uuids;
                }
            );
            return httpPromise;

        };

        return Resource;
    }

    DbResourceFactory.setSecurity = function (security) {
        securityModule = security
    };

    return DbResourceFactory

}]);
