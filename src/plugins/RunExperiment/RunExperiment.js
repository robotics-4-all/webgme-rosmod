/*globals define*/
/*jshint node:true, browser:true*/

/**
 * Generated by PluginGenerator 0.14.0 from webgme on Wed Mar 02 2016 22:17:40 GMT-0600 (Central Standard Time).
 */

define([
    'plugin/PluginConfig',
    'plugin/PluginBase',
    'common/util/ejs', // for ejs templates
    'common/util/xmljsonconverter', // used to save model as json
    'plugin/RunExperiment/RunExperiment/Templates/Templates', // 
    'rosmod/meta',
    'rosmod/remote_utils',
    'rosmod/modelLoader',
    'q'
], function (
    PluginConfig,
    PluginBase,
    ejs,
    Converter,
    TEMPLATES,
    MetaTypes,
    utils,
    loader,
    Q) {
    'use strict';

    /**
     * Initializes a new instance of RunExperiment.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin RunExperiment.
     * @constructor
     */
    var RunExperiment = function () {
        // Call base class' constructor.
        PluginBase.call(this);

        this.metaTypes = MetaTypes;
        this.FILES = {
            'node_xml': 'node.xml.ejs'
        };
    };

    // Prototypal inheritance from PluginBase.
    RunExperiment.prototype = Object.create(PluginBase.prototype);
    RunExperiment.prototype.constructor = RunExperiment;

    /**
     * Gets the name of the RunExperiment.
     * @returns {string} The name of the plugin.
     * @public
     */
    RunExperiment.prototype.getName = function () {
        return 'RunExperiment';
    };

    /**
     * Gets the semantic version (semver.org) of the RunExperiment.
     * @returns {string} The version of the plugin.
     * @public
     */
    RunExperiment.prototype.getVersion = function () {
        return '0.1.0';
    };

    /**
     * Gets the configuration structure for the ObservationSelection.
     * The ConfigurationStructure defines the configuration for the plugin
     * and will be used to populate the GUI when invoking the plugin from webGME.
     * @returns {object} The version of the plugin.
     * @public
     */
    RunExperiment.prototype.getConfigStructure = function() {
        return [
	    {
		'name': 'returnZip',
		'displayName': 'Zip and return generated artifacts.',
		'description': 'If true, it enables the client to download a zip of the artifacts.',
		'value': false,
		'valueType': 'boolean',
		'readOnly': false
	    }
        ];
    };

    /**
     * Main function for the plugin to execute. This will perform the execution.
     * Notes:
     * - Always log with the provided logger.[error,warning,info,debug].
     * - Do NOT put any user interaction logic UI, etc. inside this method.
     * - callback always has to be called even if error happened.
     *
     * @param {function(string, plugin.PluginResult)} callback - the result callback
     */
    RunExperiment.prototype.main = function (callback) {
        // Use self to access core, project, result, logger etc from PluginBase.
        // These are all instantiated at this point.
        var self = this;

        // Default fails
        self.result.success = false;

        if (typeof WebGMEGlobal !== 'undefined') {
            callback(new Error('Client-side execution is not supported'), self.result);
            return;
        }

        self.updateMETA(self.metaTypes);

	// What did the user select for our configuration?
	var currentConfig = self.getCurrentConfig();
	self.returnZip = currentConfig.returnZip;
	
	// will be filled out by the plugin
	self.containerToHostMap = {};

	loader.logger = self.logger;
	utils.logger = self.logger;

	// the active node for this plugin is experiment -> experiments -> project
	var projectNode = self.core.getParent(self.core.getParent(self.activeNode));
	var projectName = self.core.getAttribute(projectNode, 'name');

	var expName = self.core.getAttribute(self.activeNode, 'name');
	var path = require('path');
	self.gen_dir = path.join(process.cwd(), 
				 'generated', 
				 self.project.projectId, 
				 self.branchName,
				 'experiments', 
				 expName,
				 'xml');

	self.logger.info('loading project: ' + projectName);
	loader.loadProjectModel(self.core, self.META, projectNode, self.rootNode)
	    .then(function(projectModel) {
		self.projectModel = projectModel;
		self.logger.info('parsed model!');
		// update the object's selectedExperiment variable
		var expName = self.core.getAttribute(self.activeNode, 'name');
		self.selectedExperiment = self.projectModel.experiments[expName];
		// check to make sure we have the right experiment
		var expPath = self.core.getPath(self.activeNode);
		if ( expPath != self.selectedExperiment.path ) {
		    throw new String("Experiments exist with the same name, can't properly resolve!");
		}
		return self.mapContainersToHosts();
	    })
	    .then(function() {
		// generate xml files here
		self.logger.info('generating artifacts');
		return self.generateArtifacts();
	    })
	    .then(function() {
		// send the deployment + binaries off to hosts for execution
		self.logger.info('deploying onto system');
		return self.deployExperiment();
	    })
	    .then(function() {
		// create experiment nodes in the model corresponding to created experiment mapping
		return self.createModelArtifacts();
	    })
	    .then(function() {
		return self.createZip();
	    })
	    .then(function() {
		// This will save the changes. If you don't want to save;
		self.logger.info('saving updates to model');
		// exclude self.save and call callback directly from this scope.
		return; // self.save('RunExperiment updated model.');
	    })
	    .then(function (err) {
		if (err) {
		    callback(err, self.result);
		    return;
		}
		self.result.setSuccess(true);
		callback(null, self.result);
	    })
	    .catch(function(err) {
        	self.logger.error(err);
        	self.createMessage(self.activeNode, err, 'error');
		self.result.setSuccess(false);
		callback(err, self.result);
	    })
		.done();
    };

    RunExperiment.prototype.mapContainersToHosts = function () {
	var self = this;

	self.logger.info('Experiment mapping containers in ' + self.selectedExperiment.deployment.name +
			 ' to hosts in '  + self.selectedExperiment.system.name);

	var containers = self.selectedExperiment.deployment.containers;
	return utils.getAvailableHosts(self.selectedExperiment.system.hosts)
	    .then(function(hosts) {
		var containerLength = Object.keys(containers).length;
		self.logger.info( containerLength + ' mapping to ' + hosts.length);
		if (hosts.length < containerLength) {
		    throw new String('Cannot map ' + containerLength +
				     ' containers to ' + hosts.length +
				     ' available hosts.');
		}
		var containerKeys = Object.keys(containers);
		for (var i=0; i<containerLength; i++) {
		    self.containerToHostMap[containerKeys[i]] = hosts[i];
		}
	    });
    };

    RunExperiment.prototype.generateArtifacts = function () {
	var self = this;
	var path = require('path');
	var filendir = require('filendir');
	var filesToAdd = {};
	var prefix = '';

	var projectName = self.projectModel.name;

	Object.keys(self.selectedExperiment.deployment.containers).map(function (index) {
	    var container = self.selectedExperiment.deployment.containers[index];
	    Object.keys(container.nodes).map(function(ni) {
		var node = container.nodes[ni];
		node.requiredLibs = [];
		for (var ci in node.compInstances) {
		    var comp = node.compInstances[ci].component;
		    for (var l in comp.requiredLibs) {
			var lib = comp.requiredLibs[l];
			if ( lib.type == 'Source Library' && node.requiredLibs.indexOf(lib) == -1 )
			    node.requiredLibs.push(lib);
		    }
		}
		self.logger.info(JSON.stringify(node.requiredLibs, null, 2));
		var nodeXMLName = prefix + node.name + '.xml';
		var nodeXMLTemplate = TEMPLATES[self.FILES['node_xml']];
		filesToAdd[nodeXMLName] = ejs.render(nodeXMLTemplate, {nodeInfo: node});
	    });
	});

	var promises = [];

	return (function () {
	    for (var f in filesToAdd) {
		var fname = path.join(self.gen_dir, f),
		data = filesToAdd[f];

		promises.push(new Promise(function(resolve, reject) {
		    filendir.writeFile(fname, data, function(err) {
			if (err) {
			    self.logger.error(err);
			    reject(err);
			}
			else {
			    resolve();
			}
		    });
		}));
	    }
	    return Q.all(promises);
	})()
	    .then(function() {
		self.logger.debug('generated artifacts.');
		self.createMessage(self.activeNode, 'Generated artifacts.');
	    })
    };

    RunExperiment.prototype.deployExperiment = function () {
    };

    RunExperiment.prototype.createModelArtifacts = function () {
    };
			      
    RunExperiment.prototype.createZip = function() {
	var self = this;
	
	if (!self.returnZip) {
            self.createMessage(self.activeNode, 'Skipping compression.');
	    return;
	}
	
	return new Promise(function(resolve, reject) {
	    var zlib = require('zlib'),
	    tar = require('tar'),
	    fstream = require('fstream'),
	    input = self.gen_dir;

	    self.logger.info('zipping ' + input);

	    var bufs = [];

	    var packer = tar.Pack()
		.on('error', function(e) { reject(e); });

	    var gzipper = zlib.Gzip()
		.on('error', function(e) { reject(e); })
		.on('data', function(d) { bufs.push(d); })
		.on('end', function() {
		    self.logger.debug('gzip ended.');
		    var buf = Buffer.concat(bufs);
		    self.blobClient.putFile('artifacts.tar.gz',buf)
			.then(function (hash) {
			    self.result.addArtifact(hash);
			    self.logger.info('compression complete');
			    resolve();
			})
			.catch(function(err) {
			    reject(err);
			})
			    .done();
		});

	    var reader = fstream.Reader({ 'path': input, 'type': 'Directory' })
		.on('error', function(e) { reject(e); });

	    reader
		.pipe(packer)
		.pipe(gzipper);
	})
	    .then(function() {
		self.createMessage(self.activeNode, 'Created archive.');
	    });
    };

    return RunExperiment;
});
