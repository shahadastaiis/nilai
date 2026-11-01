<?php
/**
 * Jembatan Deploy Otomatis GitHub Actions -> cPanel (HTTPS Port 443/80)
 * Memvalidasi akun FTP secara lokal di Port 21 tanpa memerlukan Passive Port.
 */
error_reporting(E_ALL);
ini_set('display_errors', '0');
header('Content-Type: text/plain; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(200);
    echo "ENDPOINT_READY: Jembatan Deploy SIAKAD aktif.";
    exit;
}

$user = isset($_POST['user']) ? trim($_POST['user']) : '';
$pass = isset($_POST['pass']) ? $_POST['pass'] : '';

if ($user === '' || $pass === '') {
    http_response_code(401);
    echo "ERROR: Kredensial kosong.";
    exit;
}

function verify_ftp_credentials($username, $password) {
    $hosts = array('127.0.0.1', 'localhost');
    if (!empty($_SERVER['SERVER_ADDR'])) {
        $hosts[] = $_SERVER['SERVER_ADDR'];
    }

    foreach ($hosts as $h) {
        if (function_exists('ftp_connect')) {
            $conn = @ftp_connect($h, 21, 8);
            if ($conn) {
                $ok = @ftp_login($conn, $username, $password);
                @ftp_close($conn);
                if ($ok) return true;
            }
        }

        $fp = @fsockopen($h, 21, $errno, $errstr, 8);
        if ($fp) {
            stream_set_timeout($fp, 8);
            $line = '';
            while (($str = fgets($fp, 512)) !== false) {
                $line = $str;
                if (substr($str, 3, 1) === ' ') break;
            }
            fwrite($fp, "USER " . $username . "\r\n");
            while (($str = fgets($fp, 512)) !== false) {
                if (substr($str, 3, 1) === ' ') break;
            }
            fwrite($fp, "PASS " . $password . "\r\n");
            $resp = '';
            while (($str = fgets($fp, 512)) !== false) {
                $resp = $str;
                if (substr($str, 3, 1) === ' ') break;
            }
            fwrite($fp, "QUIT\r\n");
            fclose($fp);
            if (strpos($resp, '230') === 0) {
                return true;
            }
        }
    }
    return false;
}

if (!verify_ftp_credentials($user, $pass)) {
    http_response_code(403);
    echo "ERROR: Autentikasi FTP gagal pada server lokal.";
    exit;
}

if (!isset($_FILES['manifest']) || $_FILES['manifest']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo "ERROR: File manifest tidak ditemukan.";
    exit;
}

$raw = file_get_contents($_FILES['manifest']['tmp_name']);
$data = json_decode($raw, true);
if (!is_array($data) || !isset($data['files']) || !is_array($data['files'])) {
    http_response_code(400);
    echo "ERROR: Format manifest tidak valid.";
    exit;
}

$baseDir = __DIR__;

// Bersihkan file bundle lama di folder assets agar tidak menumpuk
$assetsDir = $baseDir . DIRECTORY_SEPARATOR . 'assets';
if (is_dir($assetsDir)) {
    foreach (scandir($assetsDir) as $item) {
        if ($item === '.' || $item === '..') continue;
        $fullPath = $assetsDir . DIRECTORY_SEPARATOR . $item;
        if (is_file($fullPath)) {
            @unlink($fullPath);
        }
    }
}

$written = 0;
foreach ($data['files'] as $relPath => $b64Content) {
    $cleanPath = ltrim(str_replace(array('\\', '..'), array('/', ''), $relPath), '/');
    if ($cleanPath === '' || $cleanPath === 'deploy.php') {
        continue;
    }
    $targetPath = $baseDir . DIRECTORY_SEPARATOR . $cleanPath;
    $targetDir = dirname($targetPath);
    if (!is_dir($targetDir)) {
        @mkdir($targetDir, 0755, true);
    }
    $decoded = base64_decode($b64Content, true);
    if ($decoded === false) {
        http_response_code(400);
        echo "ERROR: Gagal decode file " . $cleanPath;
        exit;
    }
    if (@file_put_contents($targetPath, $decoded) === false) {
        http_response_code(500);
        echo "ERROR: Gagal menulis file " . $cleanPath;
        exit;
    }
    $written++;
}

echo "DEPLOY_SUCCESS_OK: Berhasil memperbarui " . $written . " file.";
