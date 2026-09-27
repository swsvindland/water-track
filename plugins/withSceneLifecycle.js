// iOS 27 SDK refuses to launch apps that don't adopt the UIScene life cycle, but the
// SDK 57 prebuild template still creates the window in the app delegate. Expo ships
// `ExpoAppSceneDelegate` for this; this plugin wires the generated project up to it.
const fs = require('fs');
const path = require('path');
const {
  IOSConfig,
  withAppDelegate,
  withDangerousMod,
  withInfoPlist,
  withXcodeProject,
} = require('expo/config-plugins');

const SCENE_DELEGATE_FILE = 'SceneDelegate.swift';

const SCENE_DELEGATE_SOURCE = `internal import Expo

// Creates the window from the connecting scene and starts React Native into it.
class SceneDelegate: ExpoAppSceneDelegate {}
`;

const WINDOW_SETUP =
  /\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\)\n#endif\n/;

function withSceneManifest(config) {
  return withInfoPlist(config, (config) => {
    config.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return config;
  });
}

function withSceneAppDelegate(config) {
  return withAppDelegate(config, (config) => {
    if (config.modResults.language !== 'swift') {
      throw new Error('withSceneLifecycle only supports a Swift AppDelegate.');
    }
    let contents = config.modResults.contents;

    if (!contents.includes('ExpoReactNativeFactoryProvider')) {
      const classDecl = 'class AppDelegate: ExpoAppDelegate {';
      if (!contents.includes(classDecl)) {
        throw new Error('withSceneLifecycle: could not find the AppDelegate class declaration.');
      }
      contents = contents.replace(
        classDecl,
        'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {'
      );
    }

    // The scene delegate owns the window now; starting React Native here too would
    // create a second, scene-less window.
    if (contents.includes('UIWindow(frame: UIScreen.main.bounds)')) {
      if (!WINDOW_SETUP.test(contents)) {
        throw new Error('withSceneLifecycle: could not find the AppDelegate window setup to remove.');
      }
      contents = contents.replace(WINDOW_SETUP, '');
    }

    config.modResults.contents = contents;
    return config;
  });
}

function withSceneDelegateFile(config) {
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectName = IOSConfig.XcodeUtils.getProjectName(config.modRequest.projectRoot);
      const filePath = path.join(
        config.modRequest.platformProjectRoot,
        projectName,
        SCENE_DELEGATE_FILE
      );
      await fs.promises.writeFile(filePath, SCENE_DELEGATE_SOURCE);
      return config;
    },
  ]);

  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const projectName = IOSConfig.XcodeUtils.getProjectName(config.modRequest.projectRoot);
    const filepath = `${projectName}/${SCENE_DELEGATE_FILE}`;
    if (!project.hasFile(filepath)) {
      // Pass the app target explicitly: the watch app is also an application target.
      const { uuid } = IOSConfig.XcodeUtils.getApplicationNativeTarget({ project, projectName });
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath,
        groupName: projectName,
        project,
        targetUuid: uuid,
      });
    }
    return config;
  });
}

module.exports = function withSceneLifecycle(config) {
  config = withSceneManifest(config);
  config = withSceneAppDelegate(config);
  config = withSceneDelegateFile(config);
  return config;
};
