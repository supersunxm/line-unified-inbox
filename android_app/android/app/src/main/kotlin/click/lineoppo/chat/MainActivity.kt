package click.lineoppo.chat

import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
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
}
