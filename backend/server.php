<?php
require_once "lib/JWT/jwt_helper.php";
require_once "lib/Tuupola/Base58.php";
$GLOBALS['JWT_secret'] = '4Eac8AS2cw84easd65araADX';

use Tuupola\Base58;

require_once('config.php');

$data = json_decode(file_get_contents("php://input"));
$request = $data->request;

if ($request == "login") {
    $address = $data->address;

    // Prepared statement to protect against SQL injections
    $stmt = $conn->prepare("SELECT nonce FROM $tablename WHERE address = ?");
    $stmt->bindParam(1, $address);
    $stmt->execute();
    $nonce = $stmt->fetchColumn();

    if ($nonce) {
        // If user exists, return message to sign
        echo ("Sign this message to validate that you are the owner of the account. Random string: " . $nonce);
    } else {
        // If user doesn't exist, register new user with generated nonce, then return message to sign
        $nonce = uniqid();

        // Prepared statement to protect against SQL injections
        $stmt = $conn->prepare("INSERT INTO $tablename (address, nonce) VALUES (?, ?)");
        $stmt->bindParam(1, $address);
        $stmt->bindParam(2, $nonce);

        if ($stmt->execute() === TRUE) {
            echo ("Sign this message to validate that you are the owner of the account. Random string: " . $nonce);
        } else {
            echo "Error" . $stmt->error;
        }

        $conn = null;
    }

    exit;
}

if ($request == "auth") {
    $address = $data->address;
    $signature = $data->signature;

    // Prepared statement to protect against SQL injections
    if ($stmt = $conn->prepare("SELECT nonce FROM $tablename WHERE address = ?")) {
        $stmt->bindParam(1, $address);
        $stmt->execute();
        $nonce = $stmt->fetchColumn();

        $message = "Sign this message to validate that you are the owner of the account. Random string: " . $nonce;
    }

    // Check if the message was signed with the same private key to which the public address belongs
    function verifySignature(string $message, string $signature, string $address)
    {
        $base58 = new Base58(["characters" => Base58::BITCOIN]);
        return sodium_crypto_sign_verify_detached(
            $base58->decode($signature),
            $message,
            $base58->decode($address)
        );
    }

    // If verification passed, authenticate user
    if (verifySignature($message, $signature, $address)) {

        $stmt = $conn->prepare("SELECT publicName FROM $tablename WHERE address = ?");
        $stmt->bindParam(1, $address);
        $stmt->execute();
        $publicName = $stmt->fetchColumn();
        $publicName = htmlspecialchars($publicName, ENT_QUOTES, 'UTF-8');

        // Create a new random nonce for the next login
        $nonce = uniqid();
        $sql = "UPDATE $tablename SET nonce = '" . $nonce . "' WHERE address = '" . $address . "'";
        $conn->query($sql);

        // Create JWT Token
        $token = array();
        $token['address'] = $address;
        $JWT = JWT::encode($token, $GLOBALS['JWT_secret']);

        echo (json_encode(["Success", $publicName, $JWT]));
    } else {
        echo "Fail";
    }

    $conn = null;
    exit;
}

if ($request == "updatePublicName") {
    $publicName = $data->publicName;
    $address = $data->address;

    // Check if the user is logged in
    try {
        $JWT = JWT::decode($data->JWT, $GLOBALS['JWT_secret']);
    } catch (\Exception $e) {
        echo 'Authentication error';
        exit;
    }

    // Prepared statement to protect against SQL injections
    $stmt = $conn->prepare("UPDATE $tablename SET publicName = ? WHERE address = '" . $address . "'");
    $stmt->bindParam(1, $publicName);

    if ($stmt->execute() === TRUE) {
        echo "Public name for $address updated to $publicName";
    }

    $conn = null;
    exit;
}
