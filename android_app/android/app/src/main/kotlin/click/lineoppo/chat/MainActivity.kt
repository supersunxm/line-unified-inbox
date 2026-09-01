package click.lineoppo.chat

import android.app.NotificationChannel
import android.app.NotificationManager
import android.Manifest
import android.content.ContentValues
import android.content.ClipData
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.Settings
import android.provider.MediaStore
import android.media.AudioAttributes
import android.media.MediaScannerConnection
import android.media.RingtoneManager
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import java.io.File
import io.flutter.plugin.common.MethodChannel
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine

class MainActivity : FlutterActivity() {
    private val installerChannel = "click.lineoppo.chat/apk_installer"
    private val notificationSettingsChannel = "click.lineoppo.chat/notification_settings"
    private val mediaSaveChannel = "click.lineoppo.chat/media_save"
    private val apkMimeType = "application/vnd.android.package-archive"
    private val legacyWriteRequestCode = 4101
    private var pendingImageBytes: ByteArray? = null
    private var pendingImageName: String? = null
    private var pendingImageMimeType: String? = null
    private var pendingImageResult: MethodChannel.Result? = null
    private var pendingVideoBytes: ByteArray? = null
    private var pendingVideoName: String? = null
    private var pendingVideoMimeType: String? = null
    private var pendingVideoResult: MethodChannel.Result? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val channel = NotificationChannel(
            "line_oa_messages",
            "Customer messages",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "New LINE OA customer messages"
            setSound(
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .build(),
            )
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 250, 200, 250)
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
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, notificationSettingsChannel)
            .setMethodCallHandler { call, result ->
                if (call.method != "openNotificationSettings") {
                    result.notImplemented()
                    return@setMethodCallHandler
                }
                openNotificationSettings(result)
            }
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, mediaSaveChannel)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "saveImage" -> {
                        val bytes = call.argument<ByteArray>("bytes")
                        if (bytes == null || bytes.isEmpty()) {
                            result.error("EMPTY_IMAGE", "Image data is empty", null)
                            return@setMethodCallHandler
                        }
                        if (pendingImageResult != null || pendingVideoResult != null) {
                            result.error("SAVE_IN_PROGRESS", "Another media file is being saved", null)
                            return@setMethodCallHandler
                        }
                        val mimeType = call.argument<String>("mimeType")?.trim()?.lowercase()
                            ?.takeIf { it.startsWith("image/") && !it.contains('*') } ?: "image/jpeg"
                        val fileName = call.argument<String>("fileName")
                        saveImage(bytes, fileName, mimeType, result)
                    }
                    "saveVideo" -> {
                        val bytes = call.argument<ByteArray>("bytes")
                        if (bytes == null || bytes.isEmpty()) {
                            result.error("EMPTY_VIDEO", "Video data is empty", null)
                            return@setMethodCallHandler
                        }
                        if (pendingImageResult != null || pendingVideoResult != null) {
                            result.error("SAVE_IN_PROGRESS", "Another media file is being saved", null)
                            return@setMethodCallHandler
                        }
                        val mimeType = call.argument<String>("mimeType")?.trim()?.lowercase()
                            ?.takeIf { it.startsWith("video/") && !it.contains('*') } ?: "video/mp4"
                        val fileName = call.argument<String>("fileName")
                        saveVideo(bytes, fileName, mimeType, result)
                    }
                    else -> result.notImplemented()
                }
            }
    }

    private fun saveImage(
        bytes: ByteArray,
        requestedName: String?,
        mimeType: String,
        result: MethodChannel.Result,
    ) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED
        ) {
            pendingImageBytes = bytes
            pendingImageName = requestedName
            pendingImageMimeType = mimeType
            pendingImageResult = result
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.WRITE_EXTERNAL_STORAGE),
                legacyWriteRequestCode,
            )
            return
        }
        try {
            val saved = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                saveImageWithMediaStore(bytes, requestedName, mimeType)
            } else {
                saveImageLegacy(bytes, requestedName, mimeType)
            }
            if (saved) result.success(true) else result.error("SAVE_FAILED", "Image could not be saved", null)
        } catch (_: Exception) {
            result.error("SAVE_FAILED", "Image could not be saved", null)
        }
    }

    private fun saveVideo(
        bytes: ByteArray,
        requestedName: String?,
        mimeType: String,
        result: MethodChannel.Result,
    ) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED
        ) {
            pendingVideoBytes = bytes
            pendingVideoName = requestedName
            pendingVideoMimeType = mimeType
            pendingVideoResult = result
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.WRITE_EXTERNAL_STORAGE),
                legacyWriteRequestCode,
            )
            return
        }
        try {
            val saved = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                saveVideoWithMediaStore(bytes, requestedName, mimeType)
            } else {
                saveVideoLegacy(bytes, requestedName, mimeType)
            }
            if (saved) result.success(true) else result.error("SAVE_FAILED", "Video could not be saved", null)
        } catch (_: Exception) {
            result.error("SAVE_FAILED", "Video could not be saved", null)
        }
    }

    private fun saveImageWithMediaStore(
        bytes: ByteArray,
        requestedName: String?,
        mimeType: String,
    ): Boolean {
        val values = ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, safeImageName(requestedName, mimeType))
            put(MediaStore.Images.Media.MIME_TYPE, mimeType)
            put(MediaStore.Images.Media.RELATIVE_PATH, "${Environment.DIRECTORY_PICTURES}/OPPO LINE OA Chat")
            put(MediaStore.Images.Media.IS_PENDING, 1)
        }
        val resolver = contentResolver
        val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
            ?: throw IllegalStateException("Unable to create image destination")
        try {
            resolver.openOutputStream(uri)?.use { output -> output.write(bytes) }
                ?: throw IllegalStateException("Unable to open image destination")
            values.clear()
            values.put(MediaStore.Images.Media.IS_PENDING, 0)
            resolver.update(uri, values, null, null)
            return true
        } catch (error: Exception) {
            resolver.delete(uri, null, null)
            throw error
        }
    }

    private fun saveVideoWithMediaStore(
        bytes: ByteArray,
        requestedName: String?,
        mimeType: String,
    ): Boolean {
        val values = ContentValues().apply {
            put(MediaStore.Video.Media.DISPLAY_NAME, safeVideoName(requestedName, mimeType))
            put(MediaStore.Video.Media.MIME_TYPE, mimeType)
            put(MediaStore.Video.Media.RELATIVE_PATH, "${Environment.DIRECTORY_MOVIES}/OPPO LINE OA Chat")
            put(MediaStore.Video.Media.IS_PENDING, 1)
        }
        val resolver = contentResolver
        val uri = resolver.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, values)
            ?: throw IllegalStateException("Unable to create video destination")
        try {
            resolver.openOutputStream(uri)?.use { output -> output.write(bytes) }
                ?: throw IllegalStateException("Unable to open video destination")
            values.clear()
            values.put(MediaStore.Video.Media.IS_PENDING, 0)
            resolver.update(uri, values, null, null)
            return true
        } catch (error: Exception) {
            resolver.delete(uri, null, null)
            throw error
        }
    }

    @Suppress("DEPRECATION")
    private fun saveImageLegacy(
        bytes: ByteArray,
        requestedName: String?,
        mimeType: String,
    ): Boolean {
        val directory = File(
            Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES),
            "OPPO LINE OA Chat",
        )
        if (!directory.exists() && !directory.mkdirs()) {
            throw IllegalStateException("Unable to create image directory")
        }
        val file = File(directory, safeImageName(requestedName, mimeType))
        file.outputStream().use { it.write(bytes) }
        MediaScannerConnection.scanFile(this, arrayOf(file.absolutePath), arrayOf(mimeType), null)
        return true
    }

    @Suppress("DEPRECATION")
    private fun saveVideoLegacy(
        bytes: ByteArray,
        requestedName: String?,
        mimeType: String,
    ): Boolean {
        val directory = File(
            Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MOVIES),
            "OPPO LINE OA Chat",
        )
        if (!directory.exists() && !directory.mkdirs()) {
            throw IllegalStateException("Unable to create video directory")
        }
        val file = File(directory, safeVideoName(requestedName, mimeType))
        file.outputStream().use { it.write(bytes) }
        MediaScannerConnection.scanFile(this, arrayOf(file.absolutePath), arrayOf(mimeType), null)
        return true
    }

    private fun safeImageName(requestedName: String?, mimeType: String): String {
        val extension = when (mimeType) {
            "image/png" -> "png"
            "image/webp" -> "webp"
            "image/gif" -> "gif"
            else -> "jpg"
        }
        val base = requestedName
            ?.substringAfterLast('/')
            ?.substringBeforeLast('.', "")
            ?.replace(Regex("[^A-Za-z0-9_-]"), "_")
            ?.trim('_')
            ?.take(60)
            ?.ifEmpty { null }
            ?: "oppo-line-image"
        return "$base-${System.currentTimeMillis()}.$extension"
    }

    private fun safeVideoName(requestedName: String?, mimeType: String): String {
        val extension = when (mimeType) {
            "video/quicktime" -> "mov"
            "video/3gpp" -> "3gp"
            "video/webm" -> "webm"
            else -> "mp4"
        }
        val base = requestedName
            ?.substringAfterLast('/')
            ?.substringBeforeLast('.', "")
            ?.replace(Regex("[^A-Za-z0-9_-]"), "_")
            ?.trim('_')
            ?.take(60)
            ?.ifEmpty { null }
            ?: "oppo-line-video"
        return "$base-${System.currentTimeMillis()}.$extension"
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != legacyWriteRequestCode) return

        val imageResult = pendingImageResult
        if (imageResult != null) {
            val bytes = pendingImageBytes
            val name = pendingImageName
            val mimeType = pendingImageMimeType ?: "image/jpeg"
            pendingImageResult = null
            pendingImageBytes = null
            pendingImageName = null
            pendingImageMimeType = null
            if (grantResults.firstOrNull() != PackageManager.PERMISSION_GRANTED || bytes == null) {
                imageResult.error("PERMISSION_DENIED", "Storage permission is required to save images", null)
                return
            }
            saveImage(bytes, name, mimeType, imageResult)
            return
        }

        val videoResult = pendingVideoResult ?: return
        val bytes = pendingVideoBytes
        val name = pendingVideoName
        val mimeType = pendingVideoMimeType ?: "video/mp4"
        pendingVideoResult = null
        pendingVideoBytes = null
        pendingVideoName = null
        pendingVideoMimeType = null
        if (grantResults.firstOrNull() != PackageManager.PERMISSION_GRANTED || bytes == null) {
            videoResult.error("PERMISSION_DENIED", "Storage permission is required to save videos", null)
            return
        }
        saveVideo(bytes, name, mimeType, videoResult)
    }

    private fun openNotificationSettings(result: MethodChannel.Result) {
        val intent = (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                putExtra(Settings.EXTRA_APP_PACKAGE, packageName)
            }
        } else {
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.parse("package:$packageName")
            }
        }).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
            startActivity(intent)
            result.success(true)
        } catch (_: Exception) {
            result.success(false)
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
                setDataAndType(contentUri, apkMimeType)
                // Some Android/OEM package installers only honor URI grants
                // when the URI is also present in ClipData.
                clipData = ClipData.newRawUri("APK", contentUri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            if (installIntent.resolveActivity(packageManager) == null) {
                result.error("INSTALLER_UNAVAILABLE", "Unable to resolve Android package installer", null)
                return
            }
            startActivity(installIntent)
            result.success("launched")
        } catch (_: Exception) {
            result.error("INSTALLER_UNAVAILABLE", "Unable to open Android package installer", null)
        }
    }
}
