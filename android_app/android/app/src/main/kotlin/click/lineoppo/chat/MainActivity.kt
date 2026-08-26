package click.lineoppo.chat

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.core.content.FileProvider
import java.io.File
import io.flutter.plugin.common.MethodChannel
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine

class MainActivity : FlutterActivity() {
    private val installerChannel = "click.lineoppo.chat/apk_installer"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val channel = NotificationChannel(
            "line_oa_messages",
            "Customer messages",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "New LINE OA customer messages"
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, installerChannel)
            .setMethodCallHandler { call, result ->
                if (call.method != "installApk") {
                    result.notImplemented()
                    return@setMethodCallHandler
                }
                val path = call.argument<String>("path")
                if (path.isNullOrBlank()) {
                    result.error("INVALID_APK_PATH", "APK path is missing", null)
                    return@setMethodCallHandler
                }
                installApk(path, result)
            }
    }

    private fun installApk(path: String, result: MethodChannel.Result) {
        val apk = File(path)
        val cacheRoot = cacheDir.canonicalPath + File.separator
        val filesRoot = filesDir.canonicalPath + File.separator
        val canonicalPath = try {
            apk.canonicalPath
        } catch (_: Exception) {
            result.error("INVALID_APK_PATH", "APK path is invalid", null)
            return
        }
        if (!apk.isFile || !apk.canRead() ||
            (!canonicalPath.startsWith(cacheRoot) && !canonicalPath.startsWith(filesRoot))) {
            result.error("INVALID_APK_PATH", "APK is not in app-scoped storage", null)
            return
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !packageManager.canRequestPackageInstalls()) {
            val settingsIntent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                data = Uri.parse("package:$packageName")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            try {
                startActivity(settingsIntent)
                result.success("permission_required")
            } catch (_: Exception) {
                result.error("PERMISSION_SETTINGS_UNAVAILABLE", "Unable to open install permission settings", null)
            }
            return
        }

        try {
            val contentUri = FileProvider.getUriForFile(this, "$packageName.fileprovider", apk)
            val installIntent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(contentUri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            startActivity(installIntent)
            result.success("launched")
        } catch (_: Exception) {
            result.error("INSTALLER_UNAVAILABLE", "Unable to open Android package installer", null)
        }
    }
}
