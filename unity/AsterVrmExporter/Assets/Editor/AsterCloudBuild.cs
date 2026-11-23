using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace AsterVrmExporter.Editor
{
    /// <summary>
    /// Minimal deterministic build entry point for GameCI.
    /// The runtime UniGLTF/UniVRM bridge is a separate implementation milestone.
    /// </summary>
    public static class AsterCloudBuild
    {
        private const string ScenePath = "Assets/AsterVrmExporter/Scenes/Exporter.unity";

        public static void BuildWebGL()
        {
            Directory.CreateDirectory("Assets/AsterVrmExporter/Scenes");
            Directory.CreateDirectory("build/WebGL");

            var scene = EditorSceneManager.NewScene(
                NewSceneSetup.DefaultGameObjects,
                NewSceneMode.Single
            );

            if (!EditorSceneManager.SaveScene(scene, ScenePath))
            {
                Debug.LogError("Could not save the generated Aster exporter scene.");
                EditorApplication.Exit(1);
                return;
            }

            EditorBuildSettings.scenes = new[]
            {
                new EditorBuildSettingsScene(ScenePath, true)
            };

            PlayerSettings.companyName = "Aster Workshop";
            PlayerSettings.productName = "Aster VRM Export Engine";

            var options = new BuildPlayerOptions
            {
                scenes = new[] { ScenePath },
                locationPathName = "build/WebGL/index.html",
                target = BuildTarget.WebGL,
                options = BuildOptions.None
            };

            BuildReport report = BuildPipeline.BuildPlayer(options);
            bool succeeded = report.summary.result == BuildResult.Succeeded;

            Debug.Log(
                "Aster WebGL build result: " + report.summary.result +
                "; output: build/WebGL"
            );

            EditorApplication.Exit(succeeded ? 0 : 1);
        }
    }
}
