---
title: "Delivery - Hack The Box"
date: 2023-05-05
draft: false
slug: "htb-writeup-delivery"
excerpt: "Esta fue una máquina bastante interesante, lo que hicimos fue analizar el servicio HTTP para descubrir que tienen un sistema de tickets y un servidor, a su vez usan Virtual Hosting por lo que registramos los dominios y aprovechamos un ticket creado que nos crea un correo temporal en OS Ticket (su sistema de tickets), con esto usaremos el servicio Mattermost para crear una cuenta con el fin de entrar a este servicio. Una vez dentro de Mattermost, vemos mensajes del Root, que nos indican el usuario y contraseña del servicio SSH, además nos dan una pista siendo que debemos ir a la base de datos de Mattermost dentro del servicio SSH para obtener el hash del Root, con esto podremos usar las reglas de hashcat para poder crear un diccionario y poder crackear el hash para autenticarnos como Root."
categories: ["HackTheBox", "Easy Machine"]
tags: ["Linux", "OS Ticket", "Mattermost", "Virtual Hosting", "Abussing Support Ticket System", "Information Leakage", "MySQL Enumeration", "Cracking Hash", "Privesc - Cracking Root Password Hash", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "whatweb"
  - "nano"
  - "ssh"
  - "grep"
  - "mysql"
  - "hashid"
  - "hashcat"
  - "johntheripper"
links:
  - "https://forum.mattermost.com/t/solved-how-to-check-currently-installed-mattermost-server-version/3543"
  - "https://www.drivemeca.com/mattermost-linux-server/"
  - "https://help.dreamhost.com/hc/es/articles/214882998-Conectarse-a-una-base-de-datos-v%C3%ADa-SSH"
  - "https://www.dragonjar.org/identificando-el-tipo-de-hash.xhtml"
  - "https://ciberseguridad.com/herramientas/hashcat/#Crea_un_diccionario_con_hashes_MBD5"
  - "https://jesux.es/cracking/passwords-cracking/"
  - "https://www.skysnag.com/es/blog/what-is-bcrypt/"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-delivery/delivery_logo.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 10.10.10.222
PING 10.10.10.222 (10.10.10.222) 56(84) bytes of data.
64 bytes from 10.10.10.222: icmp_seq=1 ttl=63 time=131 ms
64 bytes from 10.10.10.222: icmp_seq=2 ttl=63 time=131 ms
64 bytes from 10.10.10.222: icmp_seq=3 ttl=63 time=132 ms
64 bytes from 10.10.10.222: icmp_seq=4 ttl=63 time=132 ms

--- 10.10.10.222 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3008ms
rtt min/avg/max/mdev = 130.588/131.581/132.319/0.666 ms
```
Por el TTL sabemos que la máquina usa Linux, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.10.10.222 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.93 ( https://nmap.org ) at 2023-05-05 12:22 CST
Initiating SYN Stealth Scan at 12:22
Scanning 10.10.10.222 [65535 ports]
Discovered open port 80/tcp on 10.10.10.222
Discovered open port 22/tcp on 10.10.10.222
Discovered open port 8065/tcp on 10.10.10.222
Completed SYN Stealth Scan at 12:23, 35.87s elapsed (65535 total ports)
Nmap scan report for 10.10.10.222
Host is up, received user-set (0.41s latency).
Scanned at 2023-05-05 12:22:53 CST for 35s
Not shown: 39964 filtered tcp ports (no-response), 25568 closed tcp ports (reset)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT     STATE SERVICE REASON
22/tcp   open  ssh     syn-ack ttl 63
80/tcp   open  http    syn-ack ttl 63
8065/tcp open  unknown syn-ack ttl 63

Read data files from: /usr/bin/../share/nmap
Nmap done: 1 IP address (1 host up) scanned in 35.97 seconds
           Raw packets sent: 172589 (7.594MB) | Rcvd: 26071 (1.077MB)
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

Hay 3 puertos abiertos, pero se me hace que todo se va a basar en el puerto HTTP, hagamos un escaneo de servicios.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sC -sV -p22,80,8065 10.10.10.222 -oN targeted                      
Starting Nmap 7.93 ( https://nmap.org ) at 2023-05-05 12:25 CST
Nmap scan report for 10.10.10.222
Host is up (0.13s latency).

PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 7.9p1 Debian 10+deb10u2 (protocol 2.0)

| ssh-hostkey: 
|   2048 9c40fa859b01acac0ebc0c19518aee27 (RSA)
|   256 5a0cc03b9b76552e6ec4f4b95d761709 (ECDSA)
|_  256 b79df7489da2f27630fd42d3353a808c (ED25519)
80/tcp   open  http    nginx 1.14.2

|_http-server-header: nginx/1.14.2
|_http-title: Welcome
8065/tcp open  unknown

| fingerprint-strings: 
|   GenericLines, Help, RTSPRequest, SSLSessionReq, TerminalServerCookie: 
|     HTTP/1.1 400 Bad Request
|     Content-Type: text/plain; charset=utf-8
|     Connection: close
|     Request
|   GetRequest: 
|     HTTP/1.0 200 OK
|     Accept-Ranges: bytes
|     Cache-Control: no-cache, max-age=31556926, public
|     Content-Length: 3108
|     Content-Security-Policy: frame-ancestors 'self'; script-src 'self' cdn.rudderlabs.com
|     Content-Type: text/html; charset=utf-8
|     Last-Modified: Fri, 05 May 2023 18:17:51 GMT
|     X-Frame-Options: SAMEORIGIN
|     X-Request-Id: ngd3jjncpiyr8gg7rxozrixk1w
|     X-Version-Id: 5.30.0.5.30.1.57fb31b889bf81d99d8af8176d4bbaaa.false
|     Date: Fri, 05 May 2023 18:25:24 GMT
|     <!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=0"><meta name="robots" content="noindex, nofollow"><meta name="referrer" content="no-referrer"><title>Mattermost</title><meta name="mobile-web-app-capable" content="yes"><meta name="application-name" content="Mattermost"><meta name="format-detection" content="telephone=no"><link re
|   HTTPOptions: 
|     HTTP/1.0 405 Method Not Allowed
|     Date: Fri, 05 May 2023 18:25:24 GMT
|_    Content-Length: 0
1 service unrecognized despite returning data. If you know the service/version, please submit the following fingerprint at https://nmap.org/cgi-bin/submit.cgi?new-service :
SF-Port8065-TCP:V=7.93%I=7%D=5/5%Time=64554A11%P=x86_64-pc-linux-gnu%r(Gen
SF:ericLines,67,"HTTP/1\.1\x20400\x20Bad\x20Request\r\nContent-Type:\x20te
SF:xt/plain;\x20charset=utf-8\r\nConnection:\x20close\r\n\r\n400\x20Bad\x2
SF:0Request")%r(GetRequest,DF3,"HTTP/1\.0\x20200\x20OK\r\nAccept-Ranges:\x
SF:20bytes\r\nCache-Control:\x20no-cache,\x20max-age=31556926,\x20public\r
SF:\nContent-Length:\x203108\r\nContent-Security-Policy:\x20frame-ancestor
SF:s\x20'self';\x20script-src\x20'self'\x20cdn\.rudderlabs\.com\r\nContent
SF:-Type:\x20text/html;\x20charset=utf-8\r\nLast-Modified:\x20Fri,\x2005\x
SF:20May\x202023\x2018:17:51\x20GMT\r\nX-Frame-Options:\x20SAMEORIGIN\r\nX
SF:-Request-Id:\x20ngd3jjncpiyr8gg7rxozrixk1w\r\nX-Version-Id:\x205\.30\.0
SF:\.5\.30\.1\.57fb31b889bf81d99d8af8176d4bbaaa\.false\r\nDate:\x20Fri,\x2
SF:005\x20May\x202023\x2018:25:24\x20GMT\r\n\r\n<!doctype\x20html><html\x2
SF:0lang=\"en\"><head><meta\x20charset=\"utf-8\"><meta\x20name=\"viewport\
SF:"\x20content=\"width=device-width,initial-scale=1,maximum-scale=1,user-
SF:scalable=0\"><meta\x20name=\"robots\"\x20content=\"noindex,\x20nofollow
SF:\"><meta\x20name=\"referrer\"\x20content=\"no-referrer\"><title>Matterm
SF:ost</title><meta\x20name=\"mobile-web-app-capable\"\x20content=\"yes\">
SF:<meta\x20name=\"application-name\"\x20content=\"Mattermost\"><meta\x20n
SF:ame=\"format-detection\"\x20content=\"telephone=no\"><link\x20re")%r(HT
SF:TPOptions,5B,"HTTP/1\.0\x20405\x20Method\x20Not\x20Allowed\r\nDate:\x20
SF:Fri,\x2005\x20May\x202023\x2018:25:24\x20GMT\r\nContent-Length:\x200\r\
SF:n\r\n")%r(RTSPRequest,67,"HTTP/1\.1\x20400\x20Bad\x20Request\r\nContent
SF:-Type:\x20text/plain;\x20charset=utf-8\r\nConnection:\x20close\r\n\r\n4
SF:00\x20Bad\x20Request")%r(Help,67,"HTTP/1\.1\x20400\x20Bad\x20Request\r\
SF:nContent-Type:\x20text/plain;\x20charset=utf-8\r\nConnection:\x20close\
SF:r\n\r\n400\x20Bad\x20Request")%r(SSLSessionReq,67,"HTTP/1\.1\x20400\x20
SF:Bad\x20Request\r\nContent-Type:\x20text/plain;\x20charset=utf-8\r\nConn
SF:ection:\x20close\r\n\r\n400\x20Bad\x20Request")%r(TerminalServerCookie,
SF:67,"HTTP/1\.1\x20400\x20Bad\x20Request\r\nContent-Type:\x20text/plain;\
SF:x20charset=utf-8\r\nConnection:\x20close\r\n\r\n400\x20Bad\x20Request");
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 100.00 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Ese puerto 8065 se me hace curioso, puede que estemos contra un Virtual Hosting, pero analicemos primero el puerto HTTP.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos.

<p align="center">
<img src="/assets/images/htb-writeup-delivery/Captura1.png">
</p>

Se ve chula, veamos que nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/htb-writeup-delivery/Captura2.png">
</p>

Ahora probemos con **whatweb** por si nos da algo más:
```bash
whatweb http://10.10.10.222
http://10.10.10.222 [200 OK] Country[RESERVED][ZZ], Email[jane@untitled.tld], HTML5, HTTPServer[nginx/1.14.2], IP[10.10.10.222], JQuery, Script, Title[Welcome], nginx[1.14.2]
```
Mmmmm **nginx** otra vez, tengámoslo en cuenta para más adelante.

Si analizamos la página, tiene 2 botónes que nos redirigen a otras páginas, el primero que llama la atención es el de **CONTACT US**, entremos primero a ese:

<p align="center">
<img src="/assets/images/htb-writeup-delivery/Captura3.png">
</p>

Una vez ahí, nos menciona que para usuarios no registrados podemos entrar al **HelpDesk**, ese registro nos dara un correo tipo **@delivery.htb** con el que podremos entrar al servidor **Mattermost**.

La página de **HelpDesk**, es la misma que se menciona en la página principal.

Entremos a ambas para ver que podemos encontrar:

<p align="center">
<img src="/assets/images/htb-writeup-delivery/Captura4.png">
</p>

<p align="center">
<img src="/assets/images/htb-writeup-delivery/Captura5.png">
</p>

No vemos nada, esto indica que estan aplicando **Virtual Hosting**. Vamos a registrar el dominio y subdominio (el dominio del **HelpDesk**) en el **/etc/hosts**:
```bash
nano /etc/hosts
10.10.10.222 delivery.htb helpdesk.delivery.htb
```
Y recarguemos otra vez las páginas, ya deberían verse:

<p align="center">
<img src="/assets/images/htb-writeup-delivery/Captura6.png">
</p>

<p align="center">
<img src="/assets/images/htb-writeup-delivery/Captura7.png">
</p>

Excelente, tenemos lo que parece ser un sistema de tickets y un login en la otra página, en ambas se menciona un servicio distinto, en el sistema de tickets aparece el servicio **OS Ticket** y en el login aparece **Mattermost**.

Investiguemos un poquito que son:

| **Servicio OS Ticket** |
|:-----------:|
| *Es un sistema de tickets de asistencia de código abierto. Dirige las consultas creadas a través de correo electrónico, formularios web y llamadas telefónicas hacia una plataforma de asistencia al cliente sencilla, fácil de usar y multiusuario basada en la web.* |

| **Servicio Mattermost** |
|:-----------:|
| *Mattermost es un servicio de chat en línea de código abierto y autohospedable con intercambio de archivos, búsqueda e integraciones. Está diseñado como un chat interno para organizaciones y empresas, y en su mayoría se comercializa como una alternativa de código abierto a Slack y Microsoft Teams.* |

Bien, como de momento no tenemos credenciales que podamos usar contra el login de **Mattermost**, vamos directamente a probar el sistema de tickets para poder registrarnos y crear un usuario.

### Probando Servicio OS Ticket y Ganando Acceso a Servicio Mattermost {#Ticket}

Revisando las funciones de la página, encontramos la opción para crear una cuenta, el problema es que nos piden verificar la cuenta aprobando un correo que ellos nos manden, esto no nos fucionara por lo que descartamos esta función.

Tratemos de abrir un nuevo ticket, para ver que pasa:

<p align="center">
<img src="/assets/images/htb-writeup-delivery/Captura8.png">
</p>

Nos pidió algunos datos como correo, nombre, asunto, etc. Unicamente recuerda los más importantes, que son los datos obligatorios que pide la página, esto para usarlos más adelante.

Y nos da este resultado. 

Si analizamos el ticket, nos da información que podemos guardar y probar:
* Nos dio un ID.
* Nos dio un email.

<p align="center">
<img src="/assets/images/htb-writeup-delivery/Captura9.png">
</p>

Ahora, veamos que información se muestra al revisar nuestro ticket, ve a la sección **Check Ticket Status**, probemos si con el email que nos dio podemos entrar:

<p align="center">
<img src="/assets/images/htb-writeup-delivery/Captura10.png">
</p>

Y nos da error, hagámoslo con el correo de prueba que metimos al crear el ticket:

<p align="center">
<img src="/assets/images/htb-writeup-delivery/Captura11.png">
</p>

<p align="center">
<img src="/assets/images/htb-writeup-delivery/Captura12.png">
</p>

Excelente, podemos ver la información de nuestro ticket.

Recordando lo que nos dijo la página principal, ya tenemos un correo valido para registrarnos en el servidor **Mattermost**, probemos a registrar el email que nos dio el sistema de tickets.

<p align="center">
<img src="/assets/images/htb-writeup-delivery/Captura13.png">
</p>

Muy bien, ya se creó, pero igual nos pide que verifiquemos a través de un email que **Mattermost** envío. 

<p align="center">
<img src="/assets/images/htb-writeup-delivery/Captura20.png">
</p>

¿Se abra enviado algo a la cuenta del ticket? Comprobemos:

<p align="center">
<img src="/assets/images/htb-writeup-delivery/Captura14.png">
</p>

Excelente, usemos el link que nos mandaron para autenticar la nueva cuenta del servicio **Mattermost**, solo copia y pega el link en una nueva pestaña:

<p align="center">
<img src="/assets/images/htb-writeup-delivery/Captura15.png">
</p>

Bien, escribe la contraseña de prueba que hayas puesto y logueate:

<p align="center">
<img src="/assets/images/htb-writeup-delivery/Captura16.png">
</p>

Estamos dentro, ahora podemos investigar lo que hay dentro.

## Explotación de Vulnerabilidades {#Explotacion}

### Analizando Servicio Mattermost {#Matter}

Bien, veamos que hay dentro una vez logueados:

<p align="center">
<img src="/assets/images/htb-writeup-delivery/Captura17.png">
</p>

Vamos a darle skip y veamos que nos muestra:

<p align="center">
<img src="/assets/images/htb-writeup-delivery/Captura18.png">
</p>

Al parecer, nos muestra la conversación de un usuario root hacia el equipo de desarrollo. En resumen, menciona que necesitan cambiar una plantilla del sistema de tickets y con esto da un usuario y contraseña para entrar al servidor, aunque no menciona a que servidor, supongo que se refiere al **servicio SSH**.

Además, menciona que deben crear un programa que los ayude a crear distintas contraseñas, pues no quieren que la contraseña que siempre usan en casi todo, quede registrada en el Rockyou y/o un hacker se pueda aprovechar de esta.

Antes de probar la contraseña del servidor, veamos si podemos obtener la versión del servicio **Mattermost** por si lo necesitamos después para buscar un exploit:

<p align="center">
<img src="/assets/images/htb-writeup-delivery/Captura19.png">
</p>

Ahora sí, probemos entrar al **servicio SSH**:

```bash
ssh maildeliverer@10.10.10.222
maildeliverer@10.10.10.222's password:
maildeliverer@10.10.10.222's password: 
Linux Delivery 4.19.0-13-amd64 #1 SMP Debian 4.19.160-2 (2020-11-28) x86_64

The programs included with the Debian GNU/Linux system are free software;
the exact distribution terms for each program are described in the
individual files in /usr/share/doc/*/copyright.

Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY, to the extent
permitted by applicable law.
Last login: Fri May  5 15:25:14 2023 from 10.10.14.16
maildeliverer@Delivery:~$ whoami
maildeliverer
```

¡Excelente! Busquemos la flag del usuario:
```
maildeliverer@Delivery:~$ ls
user.txt
maildeliverer@Delivery:~$ cat user.txt
...
```
Listo, ahora busquemos la forma de escalar privilegios.

## Post Explotación {#Post}

### Buscando Hashes del Servicio Mattermost {#Matter2}

Recordando lo que menciono el root en el servidor de **Mattermost**, se menciona un programa para ya no reusar la misma constraseña en todo su sistema, pues si un hacker obtiene los hashes que tienen almacenados, este puede usar las reglas de hashcat para poder crackear y obtener distintas variaciones de la misma contraseña.

Esto obviamente es una pista de lo que debemos hacer, lo principal sería buscar los hashes del servicio **Mattermost** y luego utilizar la contraseña que menciona el root (**PleaseSubscribe!**) para crear variaciones con las reglas de **hashcat**, esto con el fin de crackear esos hashes.

Busquemos información sobre donde estan estos hashes.

Checa este blog sobre **Mattermost**:
* <a href="https://www.drivemeca.com/mattermost-linux-server/" target="_blank">Mattermost Linux Server</a>

Hay un archivo llamado **config.json**, que se encuentra en el directorio **/opt/mattermost/**. 

Este puede contener información valiosa de la base de datos (como los hashes que buscamos), vayamos a verla:
```bash
maildeliverer@Delivery:~$ cd /opt/mattermost
maildeliverer@Delivery:/opt/mattermost$ ls
bin     config  ENTERPRISE-EDITION-LICENSE.txt  i18n  manifest.txt  plugins              README.md
client  data    fonts                           logs  NOTICE.txt    prepackaged_plugins  templates
maildeliverer@Delivery:/opt/mattermost$ cd config/
maildeliverer@Delivery:/opt/mattermost/config$ ls
cloud_defaults.json  config.json  README.md
```

Veamos el interior:
```json
maildeliverer@Delivery:/opt/mattermost/config$ cat config.json 
{
    "ServiceSettings": {
        "SiteURL": "",
        "WebsocketURL": "",
        "LicenseFileLocation": "",
        "ListenAddress": ":8065",
        "ConnectionSecurity": "",
        "TLSCertFile": "",
        "TLSKeyFile": "",
        "TLSMinVer": "1.2",
        "TLSStrictTransport": false,
...
```

Contiene bastante información, si usamos **grep** buscando las palabras **sql** o **mysql**, nos dará un resultado más acertado de donde buscar:
```bash
maildeliverer@Delivery:/opt/mattermost/config$ cat config.json | grep sql
        "DriverName": "mysql",
```

Y buscando eso, encontramos algo importante y crítico:
```json
"SqlSettings": {
        "DriverName": "mysql",
        "DataSource": "mmuser:Crack_The_MM_Admin_PW@tcp(127.0.0.1:3306)/mattermost?charset=utf8mb4,utf8\u0026readTimeout=30s\u0026writeTimeout=30s",
        "DataSourceReplicas": [],
        "DataSourceSearchReplicas": [],
        "MaxIdleConns": 20,
        "ConnMaxLifetimeMilliseconds": 3600000,
        "MaxOpenConns": 300,
        "Trace": false,
        "AtRestEncryptKey": "n5uax3d4f919obtsp1pw1k5xetq1enez",
        "QueryTimeout": 30,
        "DisableDatabaseSearch": false
    },
```

Tenemos un usuario y contraseña para conectarnos a la base de datos de **MySQL**.

Si no sabes como se hace esto, checa este blog:
* <a href="https://help.dreamhost.com/hc/es/articles/214882998-Conectarse-a-una-base-de-datos-v%C3%ADa-SSH" target="_blank">Conectarse a una base de datos vía SSH</a>

Bien, conectémonos:
```bash
maildeliverer@Delivery:/opt/mattermost/config$ mysql -u mmuser -p
Enter password: 
Welcome to the MariaDB monitor.  Commands end with ; or \g.
Your MariaDB connection id is 98
Server version: 10.3.27-MariaDB-0+deb10u1 Debian 10

Copyright (c) 2000, 2018, Oracle, MariaDB Corporation Ab and others.

Type 'help;' or '\h' for help. Type '\c' to clear the current input statement.

MariaDB [(none)]>
```
Ahora investiguemos la base de datos.

#### Enumeración de Base de Datos MySQL {#Mysql}

Veamos primero que bases de datos hay:
```sql
MariaDB [(none)]> show databases;
+--------------------+

| Database           |
+--------------------+

| information_schema |
| mattermost         |
+--------------------+
2 rows in set (0.001 sec)
```

Usemos la BD **Mattermost** y veamos su contenido:
```sql
MariaDB [(none)]> use mattermost
Reading table information for completion of table and column names
You can turn off this feature to get a quicker startup with -A

Database changed
MariaDB [mattermost]> show tables;
+------------------------+

| Tables_in_mattermost   |
+------------------------+

| Audits                 |
| Bots                   |
| ChannelMemberHistory   |
| ChannelMembers         |
| ...			 |
| Threads                |
| Tokens                 |
| UploadSessions         |
| UserAccessTokens       |
| UserGroups             |
| UserTermsOfService     |
| Users                  |
+------------------------+
46 rows in set (0.000 sec)
```

Tenemos varias tablas, pero me llama la atención la de **Users**, veamos su contenido:
```sql
MariaDB [mattermost]> describe Users;
+--------------------+--------------+------+-----+---------+-------+

| Field              | Type         | Null | Key | Default | Extra |
+--------------------+--------------+------+-----+---------+-------+

| Id                 | varchar(26)  | NO   | PRI | NULL    |       |
| CreateAt           | bigint(20)   | YES  | MUL | NULL    |       |
| UpdateAt           | bigint(20)   | YES  | MUL | NULL    |       |
| DeleteAt           | bigint(20)   | YES  | MUL | NULL    |       |
| Username           | varchar(64)  | YES  | UNI | NULL    |       |
| Password           | varchar(128) | YES  |     | NULL    |       |
| AuthData           | varchar(128) | YES  | UNI | NULL    |       |
| AuthService        | varchar(32)  | YES  |     | NULL    |       |
| Email              | varchar(128) | YES  | UNI | NULL    |       |
| EmailVerified      | tinyint(1)   | YES  |     | NULL    |       |
| Nickname           | varchar(64)  | YES  |     | NULL    |       |
| FirstName          | varchar(64)  | YES  |     | NULL    |       |
| LastName           | varchar(64)  | YES  |     | NULL    |       |
| Position           | varchar(128) | YES  |     | NULL    |       |
| Roles              | text         | YES  |     | NULL    |       |
| AllowMarketing     | tinyint(1)   | YES  |     | NULL    |       |
| Props              | text         | YES  |     | NULL    |       |
| NotifyProps        | text         | YES  |     | NULL    |       |
| LastPasswordUpdate | bigint(20)   | YES  |     | NULL    |       |
| LastPictureUpdate  | bigint(20)   | YES  |     | NULL    |       |
| FailedAttempts     | int(11)      | YES  |     | NULL    |       |
| Locale             | varchar(5)   | YES  |     | NULL    |       |
| Timezone           | text         | YES  |     | NULL    |       |
| MfaActive          | tinyint(1)   | YES  |     | NULL    |       |
| MfaSecret          | varchar(128) | YES  |     | NULL    |       |
+--------------------+--------------+------+-----+---------+-------+
25 rows in set (0.001 sec)
```

Excelente, ahí están las columnas del usuario y su contraseña por lo que podemos obtener las credenciales, veamos si se pueden ver:
```sql
MariaDB [mattermost]> select Username, Password from Users;
+----------------------------------+--------------------------------------------------------------+

| Username                         | Password                                                     |
+----------------------------------+--------------------------------------------------------------+

| surveybot                        |                                                              |
| c3ecacacc7b94f909d04dbfd308a9b93 | $2a$10$u5815SIBe2Fq1FZlv9S8I.VjU3zeSPBrIEg9wvpiLaS7ImuiItEiK |
| 5b785171bfb34762a933e127630c4860 | $2a$10$3m0quqyvCE8Z/R1gFcCOWO6tEj6FtqtBn8fRAXQXmaKmg.HDGpS/G |
| root                             | $2a$10$VM6EeymRxJ29r8Wjkr8Dtev0O.1STWb4.4ScG.anuu7v0EFJwgjjO |
| ff0a21fc6fc2488195e16ea854c963ee | $2a$10$RnJsISTLc9W3iUcUggl1KOG9vqADED24CQcQ8zvUm1Ir9pxS.Pduq |
| channelexport                    |                                                              |
| berserkw                         | $2a$10$z35SPIrJtjWwpEeBwfOE..IlOzRiHMkyIdWk2tvdeDBhikWQP06Iy |
| 9ecfb4be145d47fda0724f697f35ffaf | $2a$10$s.cLPSjAVgawGOJwB7vrqenPg2lrDtOECRtjwWahOzHfq1CoFyFqm |
+----------------------------------+--------------------------------------------------------------+
9 rows in set (0.000 sec)
```

Muy bien, podemos ver la **contraseña del Root**, pero está encriptada por un tipo de hash que no conocemos, vamos a guardar el **hash del Root** y vamos a crackearlo.

### Creando Diccionario con Reglas de Hashcat y Crackeando Hash de Contraseña del Usuario Root {#Hash}

Para crackear el hash, tenemos que saber el tipo de encriptado que se usó, para saberlo, usaremos la herramienta **hashid**:
```bash
hashid '$2a$10$VM6EeymRxJ29r8Wjkr8Dtev0O.1STWb4.4ScG.anuu7v0EFJwgjjO'
Analyzing '$2a$10$VM6EeymRxJ29r8Wjkr8Dtev0O.1STWb4.4ScG.anuu7v0EFJwgjjO'
[+] Blowfish(OpenBSD) 
[+] Woltlab Burning Board 4.x 
[+] bcrypt
```

El tipo de encriptado, es el que está al final. Por lo tanto, se encriptó usando **bcrypt**.

| **Encriptación Bcrypt** |
|:-----------:|
| *Bcrypt es una función de hash de contraseñas y derivación de claves para contraseñas basada en el cifrado Blowfish. Se supone que la función de derivación de claves es lenta, lo que dificulta la fuerza bruta de la contraseña. Tanto el sistema operativo OpenBSD como el software OpenSSH emplean este algoritmo hash.* |

Esto hace que sea complicado el crackear este hash, pero gracias a la pista que nos dieron y la contraseña que "ya no usan", es posible que se pueda crackear.

Ahora lo que haremos, será crear un diccionario con variaciones de la contraseña que menciona el **Root** con la herramienta **hashcat**.

Guardemos esa contraseña en un archivo:
```bash
echo "PleaseSubscribe!" > passwd
```
Para usar **hashcat**, te recomiendo que leas el siguiente blog:
* <a href="https://jesux.es/cracking/passwords-cracking/" target="_blank">Introducción al Password Cracking</a>

Ahí, hay un apartado llamado **Metodologia** donde se ven como usar las reglas de **hashcat**. Lo interesante es esto:

| **Metodologia: Uso de Reglas de Hashcat** |
|:-----------:|
| *El uso de reglas es uno de los puntos fuertes de hashcat, ya que nos permite generar mutaciones en nuestro diccionarios. Hashcat incluye diversos archivos de reglas. Podemos destacar el archivo best64 que obtiene un buen resultado con un pequeño número de reglas.* |

Ahora usando **hashcat**, usaremos la regla **best64.rule** para crear variaciones de la contraseña, también usemos el parámetro **--stdout** para utilizar el archivo **passwd** que contiene la contraseña para vaya creando dichas variaciones y el resultado se guardará en **diccionario.txt**:
```bash
hashcat -r /usr/share/hashcat/rules/best64.rule --stdout passwd > diccionario.txt
ls
credentials.txt  diccionario.txt  flags.txt  hash  passwd
```

Veamos el diccionario que se creó:
```bash
cat diccionario.txt 
PleaseSubscribe!
!ebircsbuSesaelP
PLEASESUBSCRIBE!
pleaseSubscribe!
PleaseSubscribe!0
PleaseSubscribe!1
...
PleaSu
PlesPles
asP
PlcrPlcr
PcSu
PleasS
PeSubs
```
Son bastantes variaciones, muy bien.

Por último, usemos la herramienta **John** para crackear al fin el hash del **Root**:
```bash
john -w=diccionario.txt hash                                                     
Using default input encoding: UTF-8
Loaded 1 password hash (bcrypt [Blowfish 32/64 X3])
Cost 1 (iteration count) is 1024 for all loaded hashes
Press 'q' or Ctrl-C to abort, almost any other key for status
PleaseSubscribe!21 (?)     
1g 0:00:00:07 DONE (2023-05-05 14:22) 0.1324g/s 2.781p/s 2.781c/s 2.781C/s PleaseSubscribe!12..PleaseSubscribe!21
Use the "--show" option to display all of the cracked passwords reliably
Session completed.
```

Listo, ahora autentiquemonos como el usuario Root en el **servicio SSH**:
```bash
ssh maildeliverer@10.10.10.222
maildeliverer@10.10.10.222's password: 
Linux Delivery 4.19.0-13-amd64 #1 SMP Debian 4.19.160-2 (2020-11-28) x86_64

The programs included with the Debian GNU/Linux system are free software;
the exact distribution terms for each program are described in the
individual files in /usr/share/doc/*/copyright.

Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY, to the extent
permitted by applicable law.
Last login: Fri May  5 15:51:38 2023 from 10.10.14.16
maildeliverer@Delivery:~$ su
Password: 
root@Delivery:/home/maildeliverer# whoami
root
```

Por último, buscamos la flag:
```
root@Delivery:/home/maildeliverer# cd /root
root@Delivery:~# ls
mail.sh  note.txt  py-smtp.py  root.txt
root@Delivery:~# cat root.txt
...
```

Ya con esto, completamos la máquina. Pero ojito porque hay una nota, veámosla:
```bash
root@Delivery:~# cat note.txt 
I hope you enjoyed this box, the attack may seem silly but it demonstrates a pretty high risk vulnerability I've seen several times.  The inspiration for the box is here: 

- https://medium.com/intigriti/how-i-hacked-hundreds-of-companies-through-their-helpdesk-b7680ddc2d4c 

Keep on hacking! And please don't forget to subscribe to all the security streamers out there.

- ippsec
```
Suscribete a su canal, gran maestro **Ippsec**.
