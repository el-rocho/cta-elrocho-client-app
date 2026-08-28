package es.elrocho.tensionarterial.cliente;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "FileSave")
public class FileSavePlugin extends Plugin {
    @PluginMethod
    public void saveJsonFile(PluginCall call) {
        String filename = call.getString("filename");
        String content = call.getString("content");
        if (filename == null || filename.isBlank() || content == null) {
            call.reject("Missing filename or content");
            return;
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            call.reject("Saving directly to Downloads requires Android 10 or newer");
            return;
        }

        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
        values.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);

        Uri uri = null;
        try {
            uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) {
                call.reject("Unable to create the backup in Downloads");
                return;
            }

            try (OutputStream stream = resolver.openOutputStream(uri, "w")) {
                if (stream == null) throw new IllegalStateException("Unable to open the backup file");
                stream.write(content.getBytes(StandardCharsets.UTF_8));
                stream.flush();
            }

            ContentValues completed = new ContentValues();
            completed.put(MediaStore.MediaColumns.IS_PENDING, 0);
            resolver.update(uri, completed, null, null);

            JSObject result = new JSObject();
            result.put("saved", true);
            result.put("filename", filename);
            call.resolve(result);
        } catch (Exception error) {
            if (uri != null) resolver.delete(uri, null, null);
            call.reject("Unable to save the backup in Downloads", error);
        }
    }
}
