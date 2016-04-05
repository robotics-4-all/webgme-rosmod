/*globals define*/
/*jshint node:true, browser:true*/

/**
 * Generated by PluginGenerator 0.14.0 from webgme on Wed Mar 02 2016 22:16:42 GMT-0600 (Central Standard Time).
 */

define([
    'plugin/PluginConfig',
    'plugin/PluginBase',
    'common/util/ejs', // for ejs templates
    'common/util/xmljsonconverter', // used to save model as json
    'plugin/SoftwareGenerator/SoftwareGenerator/Templates/Templates', // 
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
     * Initializes a new instance of SoftwareGenerator.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin SoftwareGenerator.
     * @constructor
     */
    var SoftwareGenerator = function () {
        // Call base class' constructor.
        PluginBase.call(this);
	//this.disableBrowserExecution = true; // why doesn't this work?
        this.metaTypes = MetaTypes;
        this.FILES = {
            'component_cpp': 'component.cpp.ejs',
            'component_hpp': 'component.hpp.ejs',
            'cmakelists': 'CMakeLists.txt.ejs',
            'package_xml': 'package_xml.ejs',
	    'doxygen_config': 'doxygen_config.ejs'
        };
    };

    // Prototypal inheritance from PluginBase.
    SoftwareGenerator.prototype = Object.create(PluginBase.prototype);
    SoftwareGenerator.prototype.constructor = SoftwareGenerator;

    /**
     * Gets the name of the SoftwareGenerator.
     * @returns {string} The name of the plugin.
     * @public
     */
    SoftwareGenerator.prototype.getName = function () {
        return 'SoftwareGenerator';
    };

    /**
     * Gets the semantic version (semver.org) of the SoftwareGenerator.
     * @returns {string} The version of the plugin.
     * @public
     */
    SoftwareGenerator.prototype.getVersion = function () {
        return '0.1.0';
    };

    /**
     * Gets the configuration structure for the ObservationSelection.
     * The ConfigurationStructure defines the configuration for the plugin
     * and will be used to populate the GUI when invoking the plugin from webGME.
     * @returns {object} The version of the plugin.
     * @public
     */
    SoftwareGenerator.prototype.getConfigStructure = function() {
        return [
            {
                'name': 'generateCPN',
                'displayName': 'Generate CPN',
                'description': 'Enables generation of CPN-based timing analysis model.',
                'value': true,
                'valueType': 'boolean',
                'readOnly': false
            },
            {
                'name': 'compile',
                'displayName': 'Compile Code',
                'description': 'Turn off to just generate source files.',
                'value': false,
                'valueType': 'boolean',
                'readOnly': false
            },
	    {
		'name': 'generate_docs',
		'displayName': 'Generate Doxygen Docs',
		'description': 'Turn off to ignorre doc generation.',
		'value': false,
		'valueType': 'boolean',
		'readOnly': false
	    },
	    {
		'name': 'returnZip',
		'displayName': 'Zip and return generated artifacts.',
		'description': 'If true, it enables the client to download a zip of the artifacts.',
		'value': true,
		'valueType': 'boolean',
		'readOnly': false
	    }
        ];
    };

    SoftwareGenerator.prototype.notify = function(level, msg) {
	var self = this;
	var prefix = self.projectId + '::' + self.projectName + '::' + level + '::';
	if (level=='error')
	    self.logger.error(msg);
	else if (level=='debug')
	    self.logger.debug(msg);
	else if (level=='info')
	    self.logger.info(msg);
	else if (level=='warning')
	    self.logger.warn(msg);
	self.createMessage(self.activeNode, msg, level);
	self.sendNotification(prefix+msg);
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
    SoftwareGenerator.prototype.main = function (callback) {
        // Use self to access core, project, result, logger etc from PluginBase.
        // These are all instantiated at this point.
        var self = this;

        // Default fails
        self.result.success = false;

        if (typeof WebGMEGlobal !== 'undefined') {
            callback(new Error('Client-side execution is not supported'), self.result);
            return;
        }
	
	// What did the user select for our configuration?
	var currentConfig = self.getCurrentConfig();
        self.logger.debug('Current configuration ' + JSON.stringify(currentConfig, null, 4));

        self.updateMETA(self.metaTypes);

	var path = require('path');

	// the active node for this plugin is software -> project
	var projectNode = self.core.getParent(self.activeNode);
	self.projectName = self.core.getAttribute(projectNode, 'name');

	// Setting up variables that will be used by various functions of this plugin
	self.gen_dir = path.join(process.cwd(),
				 'generated',
				 self.project.projectId,
				 self.branchName,
				 self.projectName);
	self.generateCPNAnalysis = currentConfig.generateCPN;
	self.compileCode = currentConfig.compile;
	self.generateDocs = currentConfig.generate_docs;
	self.returnZip = currentConfig.returnZip;
	self.projectModel = {}; // will be filled out by loadProjectModel (and associated functions)

	loader.logger = self.logger;
	utils.logger = self.logger;
      	loader.loadProjectModel(self.core, self.META, projectNode, self.rootNode)
  	    .then(function (projectModel) {
		self.projectModel = projectModel;
        	return self.generateArtifacts();
  	    })
	    .then(function () {
		return self.downloadLibraries();
	    })
	    .then(function () {
		return self.generateCPN();
	    })
	    .then(function () {
		return self.runCompilation();
	    })
	    .then(function () {
		return self.generateDocumentation();
	    })
	    .then(function () {
		return self.createZip();
	    })
	    .then(function () {
        	self.result.setSuccess(true);
        	callback(null, self.result);
	    })
	    .catch(function (err) {
		self.notify('error', err);
        	self.result.setSuccess(false);
        	callback(err, self.result);
	    })
		.done();
    };

    SoftwareGenerator.prototype.generateArtifacts = function () {
	var self = this,
	    path = require('path'),
	    filendir = require('filendir'),
	    filesToAdd = {},
	    prefix = 'src/';

	filesToAdd[self.projectModel.name + '.json'] = JSON.stringify(self.projectModel, null, 2);
        filesToAdd[self.projectModel.name + '_metadata.json'] = JSON.stringify({
    	    projectID: self.project.projectId,
            commitHash: self.commitHash,
            branchName: self.branchName,
            timeStamp: (new Date()).toISOString(),
            pluginVersion: self.getVersion()
        }, null, 2);

	var doxygenConfigName = '/doxygen_config',
	    doxygenTemplate = TEMPLATES[self.FILES['doxygen_config']];
	filesToAdd[doxygenConfigName] = ejs.render(doxygenTemplate, 
						   {'projectName': self.projectName});

        for (var pkg in self.projectModel.software.packages) {
	    var pkgInfo = self.projectModel.software.packages[pkg],
		cmakeFileName = prefix + pkgInfo.name + '/CMakeLists.txt',
		cmakeTemplate = TEMPLATES[self.FILES['cmakelists']];
	    filesToAdd[cmakeFileName] = ejs.render(cmakeTemplate, {'pkgInfo':pkgInfo});

	    var packageXMLFileName = prefix + pkgInfo.name + '/package.xml',
		packageXMLTemplate = TEMPLATES[self.FILES['package_xml']];
	    filesToAdd[packageXMLFileName] = ejs.render(packageXMLTemplate, {'pkgInfo':pkgInfo});

	    for (var cmp in pkgInfo.components) {
		var compInfo = pkgInfo.components[cmp];
		self.generateComponentFiles(filesToAdd, prefix, pkgInfo, compInfo);
	    }

	    for (var msg in pkgInfo.messages) {
		var msgInfo = pkgInfo.messages[msg],
		    msgFileName = prefix + pkgInfo.name + '/msg/' + msgInfo.name + '.msg';
		filesToAdd[msgFileName] = msgInfo.definition;
	    }

	    for (var srv in pkgInfo.services) {
		var srvInfo = pkgInfo.services[srv],
		    srvFileName = prefix + pkgInfo.name + '/srv/' + srvInfo.name + '.srv';
		filesToAdd[srvFileName] = srvInfo.definition;
	    }
	}

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
		var msg = 'Generated artifacts.';
		self.notify('info', msg);
	    })
    };

    SoftwareGenerator.prototype.generateComponentFiles = function (filesToAdd, prefix, pkgInfo, compInfo) {
	var inclFileName = prefix + pkgInfo.name + '/include/' + pkgInfo.name + '/' + compInfo.name + '.hpp',
	    srcFileName = prefix + pkgInfo.name + '/src/' + pkgInfo.name + '/' + compInfo.name + '.cpp',
	    compCPPTemplate = TEMPLATES[this.FILES['component_cpp']],
	    compHPPTemplate = TEMPLATES[this.FILES['component_hpp']];
	var moment = require('moment');
	filesToAdd[inclFileName] = ejs.render(compHPPTemplate, {'compInfo':compInfo, 'moment':moment});
	filesToAdd[srcFileName] = ejs.render(compCPPTemplate, {'compInfo':compInfo, 'moment':moment});
    };

    SoftwareGenerator.prototype.downloadLibraries = function ()
    {
	var self = this;
	var path = require('path'),
	prefix = path.join(self.gen_dir, 'src');

	// Get the required node executable
	var file_url = 'https://github.com/rosmod/rosmod-actor/releases/download/v0.3.2/rosmod-node.zip';
	var dir = prefix;

	var libraries = self.projectModel.software.libraries;
	var nodeLib = {url:file_url};
	libraries['rosmod-actor'] = nodeLib;

	var libKeys = Object.keys(libraries);
	var tasks = libKeys.map(function(libKey) {
	    var lib = libraries[libKey];
	    if (lib.url) {
		return utils.wgetAndUnzipLibrary(lib.url, dir);
	    }
	});

	return Q.all(tasks);
    };

    SoftwareGenerator.prototype.generateDocumentation = function () 
    {
	var self = this;
	if (!self.generateDocs) {
	    var msg = 'Skipping documentation generation.'
	    self.notify('info', msg);
	    return;
	}
	var msg = 'Generating documentation.'
	self.notify('info', msg);
        //self.createMessage(self.activeNode, msg);
	return new Promise(function(resolve, reject) {
	    var terminal = require('child_process').spawn('bash', [], {cwd:self.gen_dir});

	    terminal.stdout.on('data', function (data) {});

	    terminal.stderr.on('data', function (error) {
	    });

	    terminal.on('exit', function (code) {
		//self.logger.debug('document generation:: child process exited with code ' + code);
		if (code == 0) {
		    resolve(code);
		}
		else {
		    var procStderr;
		    reject('document generation:: child process exited with code ' + code);
		}
	    });

	    setTimeout(function() {
		//self.logger.debug('Sending stdin to terminal');
		terminal.stdin.write('doxygen doxygen_config\n');
		terminal.stdin.write('make -C ./doc/latex/ pdf\n');
		terminal.stdin.write('mv ./doc/latex/refman.pdf ' + utils.sanitizePath(self.projectModel.name) + '.pdf');
		//self.logger.debug('Ending terminal session');
		terminal.stdin.end();
	    }, 1000);
	})
	    .then(function() {
		self.notify('info', 'Generated doxygen documentation.');
	    });
    };

    SoftwareGenerator.prototype.generateCPN = function()
    {
	var self = this;
	if (!self.generateCPNAnalysis) {
	    var msg = 'Skipping CPN model generation.';
	    self.notify('info', msg);
	    return;
	}

	(function() {
	    var path = require('path'),
	    prefix = path.join(self.gen_dir);
	    var promises = [];

	    // Get the dummy cpn template
	    var file_url = 'https://github.com/rosmod/rosmod-cpn/releases/download/v1.0.0/cpn.zip';
	    var dir = prefix;
	    promises.push(utils.wgetAndUnzipLibrary(file_url, dir));
	    return Q.all(promises);
	})()
	.then(function() {
	    self.createMessage(self.activeNode, 'Downloaded CPN template');
	    self.createMessage(self.activeNode, self.projectModel.deployments);
	    for (var dpl in self.projectModel.deployments) {
		var dpl_model = self.projectModel.deployments[dpl]; 
		self.createMessage(self.activeNode, 'Parsing Deployment: ' + dpl_model.name);
		var timer_tokens = "1`[";
		var clock_tokens = '1`[';
		var interaction_tokens = "";
		var component_thread_tokens = "";
		var message_queue_tokens = "";
		var hardware_num = 1
		for (var c in dpl_model.containers) {
		    var container = dpl_model.containers[c];
		    self.createMessage(self.activeNode, 'Container: ' + container.name);
		    if (clock_tokens != '1`[') {
			clock_tokens += ', ';
			}
		    clock_tokens += '{node="CPU_' + hardware_num.toString() 
			+ '", value=0, next_tick=4000}';
		    self.createMessage(self.activeNodes, 'Clock Tokens: ' + clock_tokens);
		    for (var n in container.nodes) {
			var node = container.nodes[n];
			self.createMessage(self.activeNode, 'Node: ' + node.name);
			var node_priority = node.priority;
			self.createMessage(self.activeNode, 'Node Priority: ' + node_priority);
			for (var ci in node.compInstances) {
			    var compInstance = node.compInstances[ci];
			    var component = compInstance.component;
			    self.createMessage(self.activeNode, component.name);
			}
	// 1`[{node=&quot;BBB_111&quot;, period=100000, offset=0, 		
	// operation={node=&quot;BBB_111&quot;, component=&quot;Component_1&quot;, operation=&quot;Timer_1_operation&quot;, priority=50, deadline=200000, enqueue_time=0,
        // steps=[{kind=&quot;LOCAL&quot;, port=&quot;LOCAL&quot;, unblk=[], exec_time=0, 
			// duration=231000}]}}]
			
		    }
		    hardware_num += 1
		}
		clock_tokens += ']';
		self.createMessage(self.activeNode, clock_tokens);
	    }
	});
    };

    SoftwareGenerator.prototype.getValidArchitectures = function() {
	var self = this,
	validArchs = {};
	for (var sys in self.projectModel.systems) {
	    var system = self.projectModel.systems[sys];
	    for (var hst in system.hosts) {
		var host = system.hosts[hst];
		var devName = utils.getDeviceType(host);
		if (validArchs[devName] === undefined) {
		    validArchs[devName] = [];
		}
		validArchs[devName].push(host);
	    }
	}
	return validArchs;
    };

    SoftwareGenerator.prototype.selectCompilationArchitectures = function() {
	
	var self = this;

	var validArchitectures = self.getValidArchitectures();
	var promises = []

	var tasks = Object.keys(validArchitectures).map(function(index) {
	    return utils.getAvailableHosts(validArchitectures[index])
		.then(function(hostArr) {
		    var retObj = {};
		    retObj[index] = hostArr;
		    return retObj;
		});
	});
	return Q.all(tasks)
	    .then(function (nestedArr) {
		var validHosts = {};
		nestedArr.forEach(function(subArr) {
		    var arch = Object.keys(subArr)[0];
		    validHosts[arch] = subArr[arch];
		});
		return validHosts;
	    });
    };

    SoftwareGenerator.prototype.compileOnHost = function (host) {
	var self = this;
	var path = require('path');
	var mkdirp = require('mkdirp');

	var compile_dir = path.join(host.user.directory,'compilation',self.project.projectId, self.branchName);
	var archBinPath = path.join(self.gen_dir, 'bin' , utils.getDeviceType(host.host));

	var compile_commands = [
	    'cd ' + compile_dir,
	    'rm -rf bin',
	    'source /opt/ros/indigo/setup.bash',
	    'catkin_make -DNAMESPACE=rosmod',
	    'mkdir bin',
	    'cp devel/lib/*.so bin/.',
	    'cp devel/lib/node/node_main bin/.',
	    'rm -rf devel build'
	];

	// make the compile dir
	var t1 = new Promise(function(resolve,reject) {
	    self.notify('info', 'making compilation directory on: ' + host.intf.ip);
	    utils.mkdirRemote(compile_dir, host.intf.ip, host.user)
		.then(function() {
		    resolve();
		});
	});
	// copy the sources to remote
	var t2 = t1.then(function() {
	    self.notify('info', 'copying compilation sources to: ' + host.intf.ip);
	    return utils.copyToHost(self.gen_dir, compile_dir, host.intf.ip, host.user);
	});
	// run the compile step
	var t3 = t2.then(function() {
	    self.notify('info', 'compiling on: ' + host.intf.ip + ' into '+compile_dir);
	    return utils.executeOnHost(compile_commands, host.intf.ip, host.user)
		.catch(function(err) {
		    var compileErrors = utils.parseMakeErrorOutput(
			err,
			compile_dir + '/src/'
		    );
		    compileErrors.map(function(compileError) {
			var msg = 'Build Error:: ' + compileError.packageName + ':' +
			    compileError.fileName + ':' + 
			    compileError.line + ':' + compileError.column + ':\n\t' +
			    compileError.text + '\n';
			self.createMessage(null, msg);
		    });
		    throw new String('Compilation failed on ' + host.intf.ip);
		});
	});
	// make the local binary folder for the architecture
	var t4 = t3.then(function() {
	    mkdirp.sync(archBinPath);
	    return true;
	});
	// copy the compiled binaries from remote into the local bin folder
	var t5 = t4.then(function() {
	    self.notify('info', 'copying from ' + host.intf.ip + ' into local storage.');
	    return utils.copyFromHost(path.join(compile_dir, 'bin') + '/*', 
				      archBinPath + '/.',
				      host.intf.ip,
				      host.user);
	});
	// remove the remote folders
	var t6 = t5.then(function() {
	    self.notify('info', 'removing compilation artifacts off: ' + host.intf.ip);
	    return utils.executeOnHost(['rm -rf ' + compile_dir], host.intf.ip, host.user);
	});
	return Q.all([t1,t2,t3,t4,t5,t6])
	    .catch(function(err) {
		self.notify('error', err);
		throw err;
	    });
    };

    SoftwareGenerator.prototype.runCompilation = function ()
    {
	var self = this;

	if (!self.compileCode) {
	    var msg = 'Skipping compilation.';
	    self.notify('info', msg);
	    return;
	}

	var selectedHosts = [];
	return self.selectCompilationArchitectures()
	    .then(function(validHostList) {
		return self.compileBinaries(validHostList);
	    });
    };

    SoftwareGenerator.prototype.compileBinaries = function (validHostList)
    {
	var self = this;
	var selectedHosts = []

	for (var arch in validHostList) {
	    var hosts = validHostList[arch];
	    if (hosts.length) {
		selectedHosts.push(hosts[0]);
	    }
	    else {
		var msg = 'No hosts could be found for compilation on ' + arch;
		self.notify('warning', msg);
	    }
	}

	var tasks = selectedHosts.map(function (host) {
	    var msg = 'Compiling for ' + utils.getDeviceType(host.host) + ' on ' + host.intf.ip;
	    self.notify('info', msg);
	    return self.compileOnHost(host);
	});
	
	return Q.all(tasks)
	    .then(function() {
		self.createMessage(self.activeNode, 'Compiled binaries.');
	    });
    };
			      
    SoftwareGenerator.prototype.createZip = function() {
	var self = this;
	
	if (!self.returnZip) {
            self.notify('info', 'Skipping compression.');
	    return;
	}

	self.notify('info', 'Starting compression.');
	
	return new Promise(function(resolve, reject) {
	    var zlib = require('zlib'),
	    tar = require('tar'),
	    fstream = require('fstream'),
	    input = self.gen_dir;

	    var bufs = [];
	    var packer = tar.Pack()
		.on('error', function(e) { reject(e); });

	    var gzipper = zlib.Gzip()
		.on('error', function(e) { reject(e); })
		.on('data', function(d) { bufs.push(d); })
		.on('end', function() {
		    var buf = Buffer.concat(bufs);
		    self.blobClient.putFile('artifacts.tar.gz',buf)
			.then(function (hash) {
			    self.result.addArtifact(hash);
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
		self.notify('info', 'Created archive.');
	    });
    };

    return SoftwareGenerator;
});
