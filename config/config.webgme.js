// DO NOT EDIT THIS FILE
// This file is automatically generated from the webgme-setup-tool.
'use strict';


var config = require('webgme/config/config.default'),
    validateConfig = require('webgme/config/validator');

// The paths can be loaded from the webgme-setup.json
config.plugin.basePaths.push(__dirname + '/../src/plugins');
config.plugin.basePaths.push(__dirname + '/../node_modules/webgme-hfsm/src/plugins');
config.visualization.decoratorPaths.push(__dirname + '/../src/decorators');
config.visualization.decoratorPaths.push(__dirname + '/../node_modules/webgme-hfsm/src/decorators');



config.visualization.panelPaths.push(__dirname + '/../node_modules/webgme-codeeditor/src/visualizers/panels');
config.visualization.panelPaths.push(__dirname + '/../node_modules/webgme-hfsm/src/visualizers/panels');
config.visualization.panelPaths.push(__dirname + '/../node_modules/webgme-ui-replay/src/visualizers/panels');
config.visualization.panelPaths.push(__dirname + '/../src/visualizers/panels');


config.rest.components['UIRecorder'] = {
  src: __dirname + '/../node_modules/webgme-ui-replay/src/routers/UIRecorder/UIRecorder.js',
  mount: 'routers/UIRecorder',
    options: {
        mongo: {
            uri: 'mongodb://127.0.0.1:27017/webgme-ui-recording-data',
            options: {}
        }
    }
};

// Visualizer descriptors
config.visualization.visualizerDescriptors.push(__dirname + '/../src/visualizers/Visualizers.json');
// Add requirejs paths
config.requirejsPaths = {
  'UIRecorder': 'node_modules/webgme-ui-replay/src/routers/UIRecorder',
  'UIReplay': 'panels/UIReplay/UIReplayControllers',
  'HFSMViz': 'panels/HFSMViz/HFSMVizPanel',
  'CodeEditor': 'panels/CodeEditor/CodeEditorPanel',
  'UMLStateMachineDecorator': 'node_modules/webgme-hfsm/src/decorators/UMLStateMachineDecorator',
  'SoftwareGenerator': 'node_modules/webgme-hfsm/src/plugins/SoftwareGenerator',
  'panels': './src/visualizers/panels',
  'widgets': './src/visualizers/widgets',
  'panels/UIReplay': './node_modules/webgme-ui-replay/src/visualizers/panels/UIReplay',
  'widgets/UIReplay': './node_modules/webgme-ui-replay/src/visualizers/widgets/UIReplay',
  'panels/HFSMViz': './node_modules/webgme-hfsm/src/visualizers/panels/HFSMViz',
  'widgets/HFSMViz': './node_modules/webgme-hfsm/src/visualizers/widgets/HFSMViz',
  'panels/CodeEditor': './node_modules/webgme-codeeditor/src/visualizers/panels/CodeEditor',
  'widgets/CodeEditor': './node_modules/webgme-codeeditor/src/visualizers/widgets/CodeEditor',
  'webgme-hfsm': './node_modules/webgme-hfsm/src/common',
  'webgme-codeeditor': './node_modules/webgme-codeeditor/src/common',
  'webgme-ui-replay': './node_modules/webgme-ui-replay/src/common',
  'webgme-rosmod': './src/common'
};


config.mongo.uri = 'mongodb://127.0.0.1:27017/rosmod';
validateConfig(config);
module.exports = config;
